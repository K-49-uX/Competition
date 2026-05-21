// Per-clinic admin overview. Returns counts a clinic_admin needs on their
// dashboard: today's appointments + statuses, urgent triage waiting,
// prescriptions issued today, queue snapshot. Superadmins can pass
// ?clinicId=<id> to inspect any clinic; clinic-scoped roles always see
// their own clinic regardless of query.
import { Router } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { Appointment, SEVERITY_ORDER } from '../models/Appointment.js';
import { Prescription } from '../models/Prescription.js';
import { QueueState } from '../models/QueueState.js';
import { Clinic } from '../models/Clinic.js';
import { User } from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { canAccessClinic } from '../middleware/clinicScope.js';
import { recordAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { config } from '../config.js';
import { AuditLog } from '../models/AuditLog.js';

const router = Router();

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

router.get(
  '/overview',
  requireAuth,
  requireRole('admin', 'clinic_admin', 'clinician'),
  asyncHandler(async (req, res) => {
    // Resolve which clinic this overview is for.
    let clinicId = null;
    if (req.user.role === 'admin') {
      clinicId = req.query.clinicId || null; // null = aggregate across all clinics
    } else {
      if (!req.user.clinicId) return res.status(403).json({ error: 'no_clinic_assigned' });
      clinicId = req.user.clinicId;
    }
    if (clinicId && !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ error: 'invalid_clinic_id' });
    }
    if (clinicId && !canAccessClinic(req, clinicId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }

    const matchClinic = clinicId ? { clinicId: new mongoose.Types.ObjectId(clinicId) } : {};
    const todayMatch = { ...matchClinic, createdAt: { $gte: startOfToday(), $lte: endOfToday() } };

    const [
      clinic,
      todayCounts,
      severityCounts,
      prescriptionsToday,
      queue,
      staffCount,
    ] = await Promise.all([
      clinicId ? Clinic.findById(clinicId).lean() : null,
      Appointment.aggregate([
        { $match: todayMatch },
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ]),
      Appointment.aggregate([
        { $match: { ...matchClinic, status: { $in: ['waiting', 'serving'] } } },
        { $group: { _id: { $ifNull: ['$triage.severity', 'none'] }, n: { $sum: 1 } } },
      ]),
      config.features.prescriptions
        ? Prescription.countDocuments({
            ...matchClinic,
            issuedAt: { $gte: startOfToday(), $lte: endOfToday() },
          })
        : Promise.resolve(0),
      clinicId ? QueueState.findOne({ clinicId }).lean() : null,
      User.countDocuments({
        ...matchClinic,
        role: { $in: ['clinician', 'clinic_admin'] },
      }),
    ]);

    const statusMap = Object.fromEntries(todayCounts.map((c) => [c._id, c.n]));
    const sevMap = Object.fromEntries(severityCounts.map((c) => [c._id, c.n]));
    const urgentWaiting =
      (sevMap.high || 0) + (sevMap.critical || 0);

    res.json({
      scope: clinicId ? 'clinic' : 'all',
      clinic: clinic
        ? { _id: clinic._id, name: clinic.name, address: clinic.address || '' }
        : null,
      today: {
        booked: Object.values(statusMap).reduce((a, b) => a + b, 0),
        waiting: statusMap.waiting || 0,
        serving: statusMap.serving || 0,
        completed: statusMap.completed || 0,
        cancelled: statusMap.cancelled || 0,
        prescriptionsIssued: prescriptionsToday,
      },
      triage: {
        urgentWaiting,
        bySeverity: sevMap,
      },
      queue: queue
        ? { nowServing: queue.nowServing || 0, lastTicket: queue.lastTicket || 0 }
        : null,
      staff: { total: staffCount },
      generatedAt: new Date().toISOString(),
    });
  })
);

// List clinics that the caller can administer. Superadmins see all clinics
// (so they can switch context); scoped roles see only their own.
router.get(
  '/clinics',
  requireAuth,
  requireRole('admin', 'clinic_admin', 'clinician'),
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      const all = await Clinic.find({}).select('name address').sort({ name: 1 }).lean();
      return res.json({ clinics: all });
    }
    if (!req.user.clinicId) return res.json({ clinics: [] });
    const c = await Clinic.findById(req.user.clinicId).select('name address').lean();
    return res.json({ clinics: c ? [c] : [] });
  })
);

// ---------------------------------------------------------------------------
// Phase 3.2 — Staff management
//
// clinic_admin can manage staff within THEIR clinic only. Superadmins can
// manage any clinic by passing ?clinicId. Patients can never reach these
// routes (requireRole gate). Demoting users is allowed but you cannot
// demote yourself, and clinic_admins can't promote anyone to superadmin.
// ---------------------------------------------------------------------------

const STAFF_ROLES = ['clinician', 'clinic_admin'];
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

function resolveTargetClinic(req) {
  if (req.user.role === 'admin') {
    if (req.query.clinicId) return req.query.clinicId;
    if (req.body?.clinicId) return req.body.clinicId;
    return req.user.clinicId || null;
  }
  return req.user.clinicId || null;
}

router.get(
  '/staff',
  requireAuth,
  requireRole('admin', 'clinic_admin'),
  asyncHandler(async (req, res) => {
    const clinicId = resolveTargetClinic(req);
    if (!clinicId) return res.status(400).json({ error: 'no_clinic' });
    if (!canAccessClinic(req, clinicId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    const staff = await User.find({
      clinicId: new mongoose.Types.ObjectId(clinicId),
      role: { $in: STAFF_ROLES },
    })
      .select('name phone email role createdAt')
      .sort({ role: 1, name: 1 })
      .lean();
    res.json({ clinicId, staff });
  })
);

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?\d{7,15}$/).optional().or(z.literal('')),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  password: z.string().min(8).max(128),
  role: z.enum(STAFF_ROLES),
  clinicId: z.string().optional(), // superadmin only
}).refine((d) => d.phone || d.email, { message: 'phone_or_email_required' });

router.post(
  '/staff/invite',
  requireAuth,
  requireRole('admin', 'clinic_admin'),
  asyncHandler(async (req, res) => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'validation_failed', details: parsed.error.flatten() });
    }
    const { name, phone, email, password, role } = parsed.data;
    const clinicId = resolveTargetClinic(req);
    if (!clinicId) return res.status(400).json({ error: 'no_clinic' });
    if (!canAccessClinic(req, clinicId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (phone) {
      const dup = await User.findOne({ phone });
      if (dup) return res.status(409).json({ error: 'phone_in_use' });
    }
    if (email) {
      const dup = await User.findOne({ email });
      if (dup) return res.status(409).json({ error: 'email_in_use' });
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      name,
      phone: phone || undefined,
      email: email || undefined,
      passwordHash,
      role,
      clinicId,
    });
    await recordAudit({
      action: 'staff.invite', req, resource: 'User', resourceId: user._id,
      metadata: { role, clinicId: String(clinicId) },
    });
    res.status(201).json({ user: user.toSafeJSON() });
  })
);

const roleChangeSchema = z.object({
  role: z.enum(STAFF_ROLES),
});

router.patch(
  '/staff/:id/role',
  requireAuth,
  requireRole('admin', 'clinic_admin'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }
    if (String(req.user._id) === req.params.id) {
      return res.status(400).json({ error: 'cannot_change_own_role' });
    }
    const parsed = roleChangeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'validation_failed' });

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'not_found' });
    // Scoped admins can only touch users in their own clinic.
    if (req.user.role !== 'admin') {
      if (!target.clinicId || String(target.clinicId) !== String(req.user.clinicId)) {
        return res.status(403).json({ error: 'forbidden' });
      }
      // And cannot escalate to (or demote from) superadmin.
      if (target.role === 'admin') return res.status(403).json({ error: 'forbidden' });
    }
    const previousRole = target.role;
    target.role = parsed.data.role;
    await target.save();
    await recordAudit({
      action: 'staff.role_changed', req, resource: 'User', resourceId: target._id,
      metadata: { from: previousRole, to: target.role },
    });
    res.json({ user: target.toSafeJSON() });
  })
);

router.delete(
  '/staff/:id',
  requireAuth,
  requireRole('admin', 'clinic_admin'),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'invalid_id' });
    }
    if (String(req.user._id) === req.params.id) {
      return res.status(400).json({ error: 'cannot_remove_self' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'not_found' });
    if (req.user.role !== 'admin') {
      if (!target.clinicId || String(target.clinicId) !== String(req.user.clinicId)) {
        return res.status(403).json({ error: 'forbidden' });
      }
      if (target.role === 'admin') return res.status(403).json({ error: 'forbidden' });
    }
    // Soft-remove: clear clinic + drop privileges back to patient. Avoids
    // breaking historical references (appointments, prescriptions) which
    // still link via patientId/createdBy.
    target.role = 'patient';
    target.clinicId = null;
    await target.save();
    await recordAudit({
      action: 'staff.removed', req, resource: 'User', resourceId: target._id,
    });
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Phase 4.1 — Donor reporting export
//
// Returns a monthly summary (CSV) per clinic that funders typically request:
// appointments by status, urgent triage cases, prescriptions issued.
// Superadmins can export any clinic; scoped roles only their own.
// ---------------------------------------------------------------------------

function csvRow(values) {
  return values
    .map((v) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(',');
}

router.get(
  '/reports/monthly.csv',
  requireAuth,
  requireRole('admin', 'clinic_admin'),
  asyncHandler(async (req, res) => {
    const year = Number(req.query.year);
    const month = Number(req.query.month); // 1-12
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'year_and_month_required' });
    }
    const clinicId = resolveTargetClinic(req);
    if (!clinicId && req.user.role !== 'admin') {
      return res.status(400).json({ error: 'no_clinic' });
    }
    if (clinicId && !canAccessClinic(req, clinicId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const matchClinic = clinicId ? { clinicId: new mongoose.Types.ObjectId(clinicId) } : {};

    const [statusAgg, urgentAgg, prescriptionsCount, clinic] = await Promise.all([
      Appointment.aggregate([
        { $match: { ...matchClinic, createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ]),
      Appointment.aggregate([
        {
          $match: {
            ...matchClinic,
            createdAt: { $gte: start, $lt: end },
            'triage.severity': { $in: ['high', 'critical'] },
          },
        },
        { $group: { _id: '$triage.severity', n: { $sum: 1 } } },
      ]),
      config.features.prescriptions
        ? Prescription.countDocuments({ ...matchClinic, issuedAt: { $gte: start, $lt: end } })
        : Promise.resolve(0),
      clinicId ? Clinic.findById(clinicId).lean() : null,
    ]);
    const statusMap = Object.fromEntries(statusAgg.map((s) => [s._id, s.n]));
    const sevMap = Object.fromEntries(urgentAgg.map((s) => [s._id, s.n]));

    const rows = [
      csvRow(['metric', 'value']),
      csvRow(['period', `${year}-${String(month).padStart(2, '0')}`]),
      csvRow(['scope', clinicId ? 'clinic' : 'all']),
      csvRow(['clinic', clinic?.name || 'All clinics']),
      csvRow(['appointments_total', Object.values(statusMap).reduce((a, b) => a + b, 0)]),
      csvRow(['appointments_waiting', statusMap.waiting || 0]),
      csvRow(['appointments_serving', statusMap.serving || 0]),
      csvRow(['appointments_completed', statusMap.completed || 0]),
      csvRow(['appointments_cancelled', statusMap.cancelled || 0]),
      csvRow(['triage_high', sevMap.high || 0]),
      csvRow(['triage_critical', sevMap.critical || 0]),
      csvRow(['prescriptions_issued', prescriptionsCount]),
      csvRow(['generated_at', new Date().toISOString()]),
    ];
    const slug = clinic ? clinic.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'all';
    const filename = `afya-${slug}-${year}-${String(month).padStart(2, '0')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(rows.join('\n') + '\n');
  })
);

// Phase 4.2 — same monthly aggregates rendered as printable HTML (A4).
// Donors get a single page they can email/print/export to PDF without
// needing a server-side PDF library.
router.get(
  '/reports/monthly/html',
  requireAuth,
  requireRole('admin', 'clinic_admin'),
  asyncHandler(async (req, res) => {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).send('year and month required');
    }
    const clinicId = resolveTargetClinic(req);
    if (clinicId && !canAccessClinic(req, clinicId) && req.user.role !== 'admin') {
      return res.status(403).send('Forbidden');
    }
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const matchClinic = clinicId ? { clinicId: new mongoose.Types.ObjectId(clinicId) } : {};

    const [statusAgg, urgentAgg, prescriptionsCount, clinic] = await Promise.all([
      Appointment.aggregate([
        { $match: { ...matchClinic, createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: '$status', n: { $sum: 1 } } },
      ]),
      Appointment.aggregate([
        { $match: { ...matchClinic, createdAt: { $gte: start, $lt: end }, 'triage.severity': { $in: ['high', 'critical'] } } },
        { $group: { _id: '$triage.severity', n: { $sum: 1 } } },
      ]),
      config.features.prescriptions
        ? Prescription.countDocuments({ ...matchClinic, issuedAt: { $gte: start, $lt: end } })
        : Promise.resolve(0),
      clinicId ? Clinic.findById(clinicId).lean() : null,
    ]);
    const statusMap = Object.fromEntries(statusAgg.map((s) => [s._id, s.n]));
    const sevMap = Object.fromEntries(urgentAgg.map((s) => [s._id, s.n]));
    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const periodLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', { year: 'numeric', month: 'long' });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>AfyaConnect Donor Report — ${periodLabel}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; }
  h1 { color: #0d9488; margin: 0 0 4px; }
  .muted { color: #64748b; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 24px 0; }
  .stat { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
  .stat .n { font-size: 32px; font-weight: 800; color: #0d9488; }
  .stat .l { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  th, td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; text-align: left; }
  th { background: #f8fafc; font-size: 11px; text-transform: uppercase; }
  .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  .print { background: #0d9488; color: white; padding: 8px 14px; border: 0; border-radius: 8px; font-weight: 700; cursor: pointer; }
  @media print { .print { display: none; } }
</style></head><body>
<button class="print" onclick="window.print()">Save as PDF / Print</button>
<h1>AfyaConnect Donor Report</h1>
<div class="muted">${periodLabel} · ${clinic ? clinic.name : 'All partner clinics'}</div>
<div class="grid">
  <div class="stat"><div class="n">${total}</div><div class="l">Appointments booked</div></div>
  <div class="stat"><div class="n">${statusMap.completed || 0}</div><div class="l">Patients served</div></div>
  <div class="stat"><div class="n">${(sevMap.high || 0) + (sevMap.critical || 0)}</div><div class="l">Urgent / critical cases</div></div>
  <div class="stat"><div class="n">${prescriptionsCount}</div><div class="l">Prescriptions issued</div></div>
</div>
<table>
  <thead><tr><th>Status</th><th>Count</th></tr></thead>
  <tbody>
    <tr><td>Waiting</td><td>${statusMap.waiting || 0}</td></tr>
    <tr><td>Serving</td><td>${statusMap.serving || 0}</td></tr>
    <tr><td>Completed</td><td>${statusMap.completed || 0}</td></tr>
    <tr><td>Cancelled</td><td>${statusMap.cancelled || 0}</td></tr>
    <tr><td>Triage — High</td><td>${sevMap.high || 0}</td></tr>
    <tr><td>Triage — Critical</td><td>${sevMap.critical || 0}</td></tr>
  </tbody>
</table>
<div class="footer">Generated ${new Date().toUTCString()} · AfyaConnect</div>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  })
);

// Phase 3.4 — Audit log viewer. Paginated, filterable, scoped to the
// caller's clinic for clinic_admins (filters out events whose actor is
// outside their clinic). Superadmins see everything.
router.get(
  '/audit',
  requireAuth,
  requireRole('admin', 'clinic_admin'),
  asyncHandler(async (req, res) => {
    if (!config.features.audit) return res.json({ entries: [], audit: 'disabled' });
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const before = req.query.before ? new Date(req.query.before) : null;
    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.resource) filter.resource = req.query.resource;
    if (req.query.actorId && mongoose.Types.ObjectId.isValid(req.query.actorId)) {
      filter.actorId = new mongoose.Types.ObjectId(req.query.actorId);
    }
    if (before && !Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };

    // Clinic scope: limit the actorId set to staff in the caller's clinic.
    if (req.user.role !== 'admin') {
      const staff = await User.find({
        clinicId: req.user.clinicId,
        role: { $in: ['clinician', 'clinic_admin'] },
      }).select('_id').lean();
      const ids = staff.map((s) => s._id);
      filter.actorId = filter.actorId
        ? { $eq: filter.actorId, $in: ids }
        : { $in: ids };
    }
    const entries = await AuditLog.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .populate('actorId', 'name role')
      .lean();
    res.json({ entries });
  })
);

export default router;
