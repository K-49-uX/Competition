import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { Prescription } from '../models/Prescription.js';
import { Appointment } from '../models/Appointment.js';
import { Clinic } from '../models/Clinic.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { renderPrescriptionHtml } from '../services/prescriptionRender.js';

const router = Router();

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const clinicianOnly = [requireAuth, requireRole('clinician', 'admin')];

const itemSchema = z.object({
  drug:         z.string().trim().min(1).max(160),
  dose:         z.string().trim().max(80).optional(),
  frequency:    z.string().trim().max(80).optional(),
  route:        z.string().trim().max(40).optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
  quantity:     z.string().trim().max(60).optional(),
  instructions: z.string().trim().max(500).optional(),
});

const createSchema = z.object({
  appointmentId: z.string().refine(isObjectId, 'invalid_id'),
  diagnosis: z.string().trim().max(500).optional(),
  items: z.array(itemSchema).min(1, 'at_least_one_item').max(30),
  notes: z.string().trim().max(1000).optional(),
});

// Allocate the next per-clinic-per-year prescription number with a small
// retry loop in case two clinicians happen to write at the exact same
// instant. The unique index makes the duplicate-key error our hint to retry.
async function createWithSequence(payload, attempts = 5) {
  const year = new Date().getFullYear();
  for (let i = 0; i < attempts; i++) {
    const last = await Prescription.findOne({ clinicId: payload.clinicId, year })
      .sort({ prescriptionNumber: -1 })
      .select('prescriptionNumber')
      .lean();
    const next = (last?.prescriptionNumber || 0) + 1;
    try {
      return await Prescription.create({ ...payload, year, prescriptionNumber: next });
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
  }
  throw new Error('prescription_sequence_collision');
}

// POST / — create from an existing appointment. We snapshot patient details
// from the appointment so reprinting later still shows the historically
// correct name even if the user updates their profile.
router.post(
  '/',
  ...clinicianOnly,
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    const appt = await Appointment.findById(data.appointmentId)
      .populate('clinicId', '_id name')
      .populate('patientId', 'name phone')
      .lean();
    if (!appt) return res.status(404).json({ error: 'appointment_not_found' });

    const patientName = appt.patientId?.name || appt.guest?.patientName;
    if (!patientName) return res.status(400).json({ error: 'appointment_missing_patient' });

    const prescription = await createWithSequence({
      clinicId: appt.clinicId._id,
      appointmentId: appt._id,
      patientId: appt.patientId?._id,
      patientName,
      patientAge: appt.guest?.patientAge,
      patientSex: appt.guest?.patientSex,
      patientPhone: appt.patientId?.phone || appt.guest?.patientPhone,
      prescriberId: req.user._id,
      prescriberName: req.user.name || 'Clinician',
      prescriberRole: req.user.role === 'admin' ? 'Admin clinician' : 'Clinician',
      diagnosis: data.diagnosis,
      items: data.items,
      notes: data.notes,
    });
    res.status(201).json({ prescription });
  })
);

// Patient self-listing: only their own prescriptions, newest first.
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const items = await Prescription.find({ patientId: req.user._id })
      .sort({ issuedAt: -1 })
      .limit(50)
      .populate('clinicId', 'name')
      .lean();
    res.json({ prescriptions: items });
  })
);

// Clinician/admin listing optionally filtered by appointment.
router.get(
  '/',
  ...clinicianOnly,
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.appointmentId && isObjectId(req.query.appointmentId)) {
      filter.appointmentId = req.query.appointmentId;
    }
    if (req.query.patientId && isObjectId(req.query.patientId)) {
      filter.patientId = req.query.patientId;
    }
    const items = await Prescription.find(filter)
      .sort({ issuedAt: -1 })
      .limit(100)
      .populate('clinicId', 'name')
      .lean();
    res.json({ prescriptions: items });
  })
);

// Helper: returns prescription if user is allowed to read it (admin/clinician
// always; patient only their own), else null.
async function loadAuthorised(req, populated = false) {
  if (!isObjectId(req.params.id)) return null;
  const q = Prescription.findById(req.params.id);
  if (populated) q.populate('clinicId', 'name address phone');
  const p = await q.lean();
  if (!p) return null;
  const isStaff = req.user.role === 'admin' || req.user.role === 'clinician';
  const isOwner = p.patientId && String(p.patientId) === String(req.user._id);
  if (!isStaff && !isOwner) return false;
  return p;
}

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const p = await loadAuthorised(req);
    if (p === null) return res.status(404).json({ error: 'not_found' });
    if (p === false) return res.status(403).json({ error: 'forbidden' });
    res.json({ prescription: p });
  })
);

// Printable HTML — same renderer used by the "Save as PDF" button. Express 5
// routing requires the extension to be its own URL segment (path-to-regexp
// no longer supports `:id.html`). See routes/transparency.js for the same
// pattern.
router.get(
  '/:id/html',
  requireAuth,
  asyncHandler(async (req, res) => {
    const p = await loadAuthorised(req, true);
    if (p === null) return res.status(404).send('Not found');
    if (p === false) return res.status(403).send('Forbidden');
    const clinic = p.clinicId && typeof p.clinicId === 'object' ? p.clinicId : await Clinic.findById(p.clinicId).lean();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPrescriptionHtml(p, clinic));
  })
);

export default router;
