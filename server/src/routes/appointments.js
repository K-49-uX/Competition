import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Appointment, RED_FLAG_SYMPTOMS, SEVERITY_ORDER, suggestSeverityFromSymptoms } from '../models/Appointment.js';
import { Clinic } from '../models/Clinic.js';
import { QueueState } from '../models/QueueState.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getIo } from '../realtime/io.js';

const router = Router();

// Limit guest booking to 6 requests / 10 min per IP to deter spam.
const guestBookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

// Limit guest ticket lookups (read-only) more generously.
const guestLookupLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Slot helpers — clinics expose fixed time slots so patients can only pick a
// time the clinic has actually opened. Prevents congestion and double booking.
// ---------------------------------------------------------------------------

// Default working hours if a clinic has no `hours` string set.
const DEFAULT_OPEN_HOUR = 8;     // 08:00
const DEFAULT_CLOSE_HOUR = 17;   // 17:00
// Patients allowed per slot (small group buffer beyond the average service time).
const DEFAULT_SLOT_CAPACITY = 2;
// How many days ahead a patient may book.
const MAX_DAYS_AHEAD = 14;

function parseHours(hoursStr) {
  // Accepts "08:00 - 17:00" / "8:00-17:30" / similar. Falls back to defaults.
  if (typeof hoursStr === 'string') {
    const m = hoursStr.match(/(\d{1,2}):(\d{2})\s*[-–to]+\s*(\d{1,2}):(\d{2})/i);
    if (m) {
      const oh = Number(m[1]);
      const om = Number(m[2]);
      const ch = Number(m[3]);
      const cm = Number(m[4]);
      if (oh >= 0 && oh < 24 && ch > oh && ch <= 24) {
        return { openMinutes: oh * 60 + om, closeMinutes: ch * 60 + cm };
      }
    }
  }
  return { openMinutes: DEFAULT_OPEN_HOUR * 60, closeMinutes: DEFAULT_CLOSE_HOUR * 60 };
}

// Returns the slot minute size for a clinic. Rounded up to the nearest 5 min
// for friendlier display, with a minimum of 10 minutes.
function slotSizeFor(clinic) {
  const avg = Math.max(10, Number(clinic.avgServiceMinutes) || 10);
  return Math.ceil(avg / 5) * 5;
}

// Build all candidate slot Date objects for a clinic on a given local-day.
function buildSlotsForDate(clinic, dayDate) {
  const { openMinutes, closeMinutes } = parseHours(clinic.hours);
  const slotMin = slotSizeFor(clinic);
  const slots = [];
  for (let m = openMinutes; m + slotMin <= closeMinutes; m += slotMin) {
    const d = new Date(dayDate);
    d.setHours(0, 0, 0, 0);
    d.setMinutes(m);
    slots.push(d);
  }
  return slots;
}

function startOfDay(dateLike) {
  const d = new Date(dateLike);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(dateLike) {
  const d = new Date(dateLike);
  d.setHours(23, 59, 59, 999);
  return d;
}

// Public slot listing — patients pick from clinic-provided times only, so
// scheduling stays under the clinic's control and avoids congestion.
const slotsQuerySchema = z.object({
  clinicId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

router.get(
  '/slots',
  guestLookupLimiter,
  asyncHandler(async (req, res) => {
    const parsed = slotsQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'validation_failed' });

    const clinic = await Clinic.findById(parsed.data.clinicId).lean();
    if (!clinic) return res.status(404).json({ error: 'clinic_not_found' });

    const day = parsed.data.date ? new Date(`${parsed.data.date}T00:00:00`) : new Date();
    if (Number.isNaN(day.getTime())) return res.status(400).json({ error: 'invalid_date' });

    const today = startOfDay(new Date());
    const maxDay = startOfDay(new Date(Date.now() + MAX_DAYS_AHEAD * 86_400_000));
    if (startOfDay(day) < today || startOfDay(day) > maxDay) {
      return res.status(400).json({ error: 'date_out_of_range' });
    }

    const candidates = buildSlotsForDate(clinic, day);
    const now = new Date();

    // Count bookings already taken at each slot start time.
    const taken = await Appointment.aggregate([
      {
        $match: {
          clinicId: clinic._id,
          status: { $in: ['waiting', 'serving'] },
          scheduledFor: { $gte: startOfDay(day), $lte: endOfDay(day) },
        },
      },
      { $group: { _id: '$scheduledFor', count: { $sum: 1 } } },
    ]);
    const takenMap = new Map(taken.map((t) => [new Date(t._id).getTime(), t.count]));

    const slots = candidates.map((d) => {
      const used = takenMap.get(d.getTime()) || 0;
      const remaining = Math.max(0, DEFAULT_SLOT_CAPACITY - used);
      return {
        time: d.toISOString(),
        label: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        remaining,
        full: remaining === 0,
        past: d.getTime() <= now.getTime(),
      };
    });

    res.json({
      clinicId: clinic._id,
      clinicName: clinic.name,
      date: startOfDay(day).toISOString().slice(0, 10),
      slotMinutes: slotSizeFor(clinic),
      capacityPerSlot: DEFAULT_SLOT_CAPACITY,
      slots,
    });
  })
);

const RED_FLAG_KEYS = Object.keys(RED_FLAG_SYMPTOMS);
const symptomList = z.array(z.enum(RED_FLAG_KEYS)).max(10).optional();

const createSchema = z.object({
  clinicId: z.string(),
  scheduledFor: z.string().optional(),
  reason: z.string().optional(),
  selfReportedSymptoms: symptomList,
});

const guestSchema = z.object({
  clinicId: z.string().min(1, 'clinic_required'),
  scheduledFor: z.string().optional(),
  reason: z.string().max(500).optional(),
  patientName: z.string().trim().min(2, 'name_required').max(120),
  patientAge: z.coerce.number().int().min(0).max(130).optional(),
  patientSex: z.enum(['female', 'male', 'other', 'prefer_not_say']).optional(),
  patientPhone: z.string().trim().min(7, 'phone_required').max(30),
  nationality: z.string().trim().max(80).optional(),
  blockOrCamp: z.string().trim().max(120).optional(),
  preferredLang: z.string().trim().max(20).optional(),
  helperName: z.string().trim().max(120).optional(),
  helperPhone: z.string().trim().max(30).optional(),
  relationship: z.string().trim().max(80).optional(),
  selfReportedSymptoms: symptomList,
  consent: z.literal(true, {
    errorMap: () => ({ message: 'consent_required' }),
  }),
});

// Public guest booking — no auth needed (e.g. patient borrowing somebody's phone)
router.post(
  '/guest',
  guestBookingLimiter,
  asyncHandler(async (req, res) => {
    const parsed = guestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_failed',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const data = parsed.data;
    const clinic = await Clinic.findById(data.clinicId);
    if (!clinic) return res.status(404).json({ error: 'clinic_not_found' });

    // One-active-booking rule — a phone number can only hold a single open
    // ticket at a time. Prevents patients (or jokers) from hoarding slots.
    const existing = await Appointment.findOne({
      'guest.patientPhone': data.patientPhone,
      status: { $in: ['waiting', 'serving'] },
    })
      .populate('clinicId', 'name')
      .lean();
    if (existing) {
      return res.status(409).json({
        error: 'duplicate_active_booking',
        existing: {
          ticketNumber: existing.ticketNumber,
          status: existing.status,
          clinicName: existing.clinicId?.name,
          scheduledFor: existing.scheduledFor,
        },
      });
    }

    // Slot validation — when the patient picks a time, it must match a slot the
    // clinic publishes and that slot must still have capacity.
    let scheduledFor = new Date();
    if (data.scheduledFor) {
      const requested = new Date(data.scheduledFor);
      if (Number.isNaN(requested.getTime())) {
        return res.status(400).json({ error: 'invalid_slot' });
      }
      const candidates = buildSlotsForDate(clinic, requested);
      const match = candidates.find((c) => c.getTime() === requested.getTime());
      if (!match) return res.status(400).json({ error: 'invalid_slot' });
      if (match.getTime() < Date.now() - 60_000) {
        return res.status(400).json({ error: 'slot_in_past' });
      }
      const used = await Appointment.countDocuments({
        clinicId: clinic._id,
        scheduledFor: match,
        status: { $in: ['waiting', 'serving'] },
      });
      if (used >= DEFAULT_SLOT_CAPACITY) {
        return res.status(409).json({ error: 'slot_full' });
      }
      scheduledFor = match;
    }

    const date = todayKey();
    const state = await QueueState.findOneAndUpdate(
      { clinicId: clinic._id },
      [
        {
          $set: {
            date: { $cond: [{ $eq: ['$date', date] }, '$date', date] },
            currentlyServing: { $cond: [{ $eq: ['$date', date] }, '$currentlyServing', 0] },
            lastIssued: { $cond: [{ $eq: ['$date', date] }, { $add: ['$lastIssued', 1] }, 1] },
          },
        },
      ],
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const symptoms = data.selfReportedSymptoms || [];
    const suggested = suggestSeverityFromSymptoms(symptoms);
    const appt = await Appointment.create({
      clinicId: clinic._id,
      scheduledFor,
      ticketNumber: state.lastIssued,
      reason: data.reason,
      triage: { severity: suggested, selfReportedSymptoms: symptoms },
      guest: {
        patientName:   data.patientName,
        patientAge:    data.patientAge,
        patientSex:    data.patientSex,
        patientPhone:  data.patientPhone,
        nationality:   data.nationality,
        blockOrCamp:   data.blockOrCamp,
        preferredLang: data.preferredLang,
        helperName:    data.helperName,
        helperPhone:   data.helperPhone,
        relationship:  data.relationship,
      },
    });

    try {
      getIo().to(`clinic:${clinic._id}`).emit('queue:issued', {
        clinicId: clinic._id,
        ticketNumber: appt.ticketNumber,
        guest: true,
      });
    } catch { /* socket optional */ }

    res.status(201).json({
      appointment: {
        _id: appt._id,
        clinicId: clinic._id,
        clinicName: clinic.name,
        clinicAddress: clinic.address,
        ticketNumber: appt.ticketNumber,
        status: appt.status,
        scheduledFor: appt.scheduledFor,
      },
      queue: {
        currentlyServing: state.currentlyServing,
        lastIssued: state.lastIssued,
        avgServiceMinutes: clinic.avgServiceMinutes,
        estimatedWaitMinutes: Math.max(0, (appt.ticketNumber - state.currentlyServing) * clinic.avgServiceMinutes),
      },
    });
  })
);

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const clinic = await Clinic.findById(data.clinicId);
    if (!clinic) return res.status(404).json({ error: 'clinic_not_found' });

    // One-active-booking rule for logged-in patients (mirror of guest path).
    const existing = await Appointment.findOne({
      patientId: req.user._id,
      status: { $in: ['waiting', 'serving'] },
    })
      .populate('clinicId', 'name')
      .lean();
    if (existing) {
      return res.status(409).json({
        error: 'duplicate_active_booking',
        existing: {
          _id: existing._id,
          ticketNumber: existing.ticketNumber,
          status: existing.status,
          clinicName: existing.clinicId?.name,
          scheduledFor: existing.scheduledFor,
        },
      });
    }

    const date = todayKey();
    const state = await QueueState.findOneAndUpdate(
      { clinicId: clinic._id },
      [
        {
          $set: {
            date: { $cond: [{ $eq: ['$date', date] }, '$date', date] },
            currentlyServing: { $cond: [{ $eq: ['$date', date] }, '$currentlyServing', 0] },
            lastIssued: { $cond: [{ $eq: ['$date', date] }, { $add: ['$lastIssued', 1] }, 1] },
          },
        },
      ],
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const symptoms = data.selfReportedSymptoms || [];
    const suggested = suggestSeverityFromSymptoms(symptoms);
    const appt = await Appointment.create({
      patientId: req.user._id,
      clinicId: clinic._id,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : new Date(),
      ticketNumber: state.lastIssued,
      reason: data.reason,
      triage: { severity: suggested, selfReportedSymptoms: symptoms },
    });

    res.status(201).json({
      appointment: appt,
      queue: {
        currentlyServing: state.currentlyServing,
        lastIssued: state.lastIssued,
        avgServiceMinutes: clinic.avgServiceMinutes,
        estimatedWaitMinutes: Math.max(0, (appt.ticketNumber - state.currentlyServing) * clinic.avgServiceMinutes),
      },
    });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const appts = await Appointment.find({ patientId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('clinicId', 'name address avgServiceMinutes')
      .lean();
    res.json({ appointments: appts });
  })
);

router.post(
  '/:id/cancel',
  requireAuth,
  asyncHandler(async (req, res) => {
    const appt = await Appointment.findOneAndUpdate(
      { _id: req.params.id, patientId: req.user._id, status: 'waiting' },
      { status: 'cancelled' },
      { new: true }
    );
    if (!appt) return res.status(404).json({ error: 'not_found' });
    getIo().to(`clinic:${appt.clinicId}`).emit('queue:cancelled', { appointmentId: appt._id });
    res.json({ appointment: appt });
  })
);

// ---------------------------------------------------------------------------
// Public guest ticket lookup — phone + ticket number, no auth.
// Returns the appointment if those two values match a booking from today
// (so old tickets can't be enumerated indefinitely).
// ---------------------------------------------------------------------------
const lookupSchema = z.object({
  phone: z.string().trim().min(4).max(40),
  ticket: z.coerce.number().int().min(1).max(99_999),
});

router.get(
  '/guest/lookup',
  guestLookupLimiter,
  asyncHandler(async (req, res) => {
    const parsed = lookupSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'validation_failed' });
    const { phone, ticket } = parsed.data;

    // Restrict to today (issued ticket numbers reset per day).
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const appt = await Appointment.findOne({
      ticketNumber: ticket,
      'guest.patientPhone': phone,
      createdAt: { $gte: startOfDay },
    })
      .populate('clinicId', 'name address avgServiceMinutes')
      .lean();

    if (!appt) return res.status(404).json({ error: 'not_found' });

    const state = await QueueState.findOne({ clinicId: appt.clinicId._id }).lean();
    const currentlyServing = state?.currentlyServing || 0;
    const avgServiceMinutes = appt.clinicId?.avgServiceMinutes || 10;

    res.json({
      appointment: {
        _id: appt._id,
        ticketNumber: appt.ticketNumber,
        status: appt.status,
        scheduledFor: appt.scheduledFor,
        clinicName: appt.clinicId?.name,
        clinicAddress: appt.clinicId?.address,
      },
      queue: {
        currentlyServing,
        estimatedWaitMinutes: Math.max(0, (appt.ticketNumber - currentlyServing) * avgServiceMinutes),
      },
    });
  })
);

// ---------------------------------------------------------------------------
// Admin / clinician inbox of all appointments (with optional filters).
// ---------------------------------------------------------------------------
router.get(
  '/admin',
  requireAuth,
  requireRole('admin', 'clinic_admin', 'clinician'),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.clinicId) filter.clinicId = req.query.clinicId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.date) {
      const d = new Date(req.query.date);
      if (!Number.isNaN(d.getTime())) {
        const start = new Date(d); start.setHours(0, 0, 0, 0);
        const end = new Date(d); end.setHours(23, 59, 59, 999);
        filter.createdAt = { $gte: start, $lte: end };
      }
    }
    // Clinic-scoped roles (clinician + clinic_admin) can never see other
    // clinics' inboxes regardless of the clinicId query param.
    if (['clinician', 'clinic_admin'].includes(req.user.role)) {
      if (!req.user.clinicId) return res.json({ appointments: [] });
      filter.clinicId = req.user.clinicId;
    }
    const items = await Appointment.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('clinicId', 'name address')
      .populate('patientId', 'name phone email')
      .lean();
    // In-memory secondary sort: keep critical/high triage at the top of the
    // inbox so they're never missed, while preserving newest-first inside the
    // same severity bucket. Done in JS to avoid a compound index migration.
    items.sort((a, b) => {
      const sa = SEVERITY_ORDER[a.triage?.severity || 'none'] || 0;
      const sb = SEVERITY_ORDER[b.triage?.severity || 'none'] || 0;
      if (sa !== sb) return sb - sa;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    res.json({ appointments: items });
  })
);

// ---------------------------------------------------------------------------
// Triage — clinician/admin sets severity + notes after assessing the patient.
// Emits a realtime event so the inbox reorders without a manual refresh.
// ---------------------------------------------------------------------------
const triageSchema = z.object({
  severity: z.enum(['none', 'low', 'moderate', 'high', 'critical']),
  notes: z.string().trim().max(1000).optional(),
});

router.post(
  '/:id/triage',
  requireAuth,
  requireRole('admin', 'clinician'),
  asyncHandler(async (req, res) => {
    const data = triageSchema.parse(req.body);
    const appt = await Appointment.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          'triage.severity':   data.severity,
          'triage.notes':      data.notes || '',
          'triage.assessedAt': new Date(),
          'triage.assessedBy': req.user._id,
        },
      },
      { new: true }
    ).lean();
    if (!appt) return res.status(404).json({ error: 'not_found' });
    try {
      getIo().to(`clinic:${appt.clinicId}`).emit('appointment:triage', {
        appointmentId: appt._id,
        ticketNumber: appt.ticketNumber,
        severity: appt.triage?.severity,
      });
    } catch { /* socket optional */ }
    res.json({ appointment: appt });
  })
);

// Triage symptom catalogue — keeps the patient-facing labels in one place
// the client can render without hardcoding the keys.
router.get('/triage/symptoms', (_req, res) => {
  res.json({
    symptoms: Object.entries(RED_FLAG_SYMPTOMS).map(([key, suggestedSeverity]) => ({
      key,
      suggestedSeverity,
    })),
  });
});

export default router;
