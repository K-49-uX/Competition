import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { PatientRecord } from '../models/PatientRecord.js';
import { VisitNote } from '../models/VisitNote.js';
import { Appointment } from '../models/Appointment.js';
import { User } from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Build a stable record shell so the client can render even when the patient
// has no record yet (lazy-create on first write).
function emptyRecord(patientId) {
  return {
    patientId,
    bloodType: 'unknown',
    vitals: [],
    allergies: [],
    conditions: [],
    medications: [],
    immunisations: [],
    summary: '',
    lastReviewedAt: null,
    lastReviewedBy: null,
    _new: true,
  };
}

// --- Patient self-view ----------------------------------------------------
// Patients can read their own record (read-only) plus their visit notes
// flagged `patient_visible`. Notes flagged `clinician_only` are never
// returned through this endpoint.
router.get(
  '/me/record',
  requireAuth,
  asyncHandler(async (req, res) => {
    const patientId = req.user._id;
    const [record, notes] = await Promise.all([
      PatientRecord.findOne({ patientId }).lean(),
      VisitNote.find({ patientId, visibility: 'patient_visible' })
        .sort({ visitedAt: -1 })
        .limit(50)
        .lean(),
    ]);
    res.json({
      record: record || emptyRecord(patientId),
      visits: notes,
    });
  })
);

// --- Clinician-facing endpoints ------------------------------------------
const clinicianOnly = [requireAuth, requireRole('clinician', 'admin')];

router.get(
  '/:patientId/record',
  ...clinicianOnly,
  asyncHandler(async (req, res) => {
    const { patientId } = req.params;
    if (!isObjectId(patientId)) return res.status(400).json({ error: 'invalid_id' });

    const [patient, record, notes] = await Promise.all([
      User.findById(patientId).select('name phone email language role createdAt').lean(),
      PatientRecord.findOne({ patientId }).lean(),
      VisitNote.find({ patientId }).sort({ visitedAt: -1 }).limit(50).lean(),
    ]);
    if (!patient) return res.status(404).json({ error: 'patient_not_found' });
    if (patient.role !== 'patient') return res.status(400).json({ error: 'not_a_patient' });

    res.json({
      patient,
      record: record || emptyRecord(patientId),
      visits: notes,
    });
  })
);

// Whitelisted top-level fields the PATCH may touch. We don't allow array
// replacement here — separate add/remove endpoints handle list mutations
// so we never accidentally drop history with a partial payload.
const recordPatchSchema = z.object({
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown']).optional(),
  summary: z.string().max(2000).optional(),
});

router.patch(
  '/:patientId/record',
  ...clinicianOnly,
  asyncHandler(async (req, res) => {
    const { patientId } = req.params;
    if (!isObjectId(patientId)) return res.status(400).json({ error: 'invalid_id' });
    const data = recordPatchSchema.parse(req.body);

    const update = {
      ...data,
      lastReviewedAt: new Date(),
      lastReviewedBy: req.user._id,
    };
    const record = await PatientRecord.findOneAndUpdate(
      { patientId },
      { $set: update, $setOnInsert: { patientId } },
      { new: true, upsert: true }
    ).lean();
    res.json({ record });
  })
);

// Generic list-add endpoint. `kind` controls which array to push to and which
// schema to validate against. Returns the updated record so the client can
// re-render in one round-trip.
const listSchemas = {
  vitals: z.object({
    at: z.coerce.date().optional(),
    heightCm: z.number().min(0).max(300).optional(),
    weightKg: z.number().min(0).max(500).optional(),
    temperatureC: z.number().min(25).max(45).optional(),
    heartRate: z.number().int().min(20).max(250).optional(),
    respiratoryRate: z.number().int().min(4).max(80).optional(),
    bloodPressureSystolic: z.number().int().min(40).max(260).optional(),
    bloodPressureDiastolic: z.number().int().min(20).max(200).optional(),
    spo2: z.number().int().min(30).max(100).optional(),
    notes: z.string().max(500).optional(),
  }),
  allergies: z.object({
    substance: z.string().trim().min(1).max(120),
    reaction: z.string().max(240).optional(),
    severity: z.enum(['mild', 'moderate', 'severe', 'life-threatening']).optional(),
  }),
  conditions: z.object({
    name: z.string().trim().min(1).max(120),
    icd10: z.string().max(12).optional(),
    status: z.enum(['active', 'resolved', 'remission']).optional(),
    diagnosedAt: z.coerce.date().optional(),
    notes: z.string().max(500).optional(),
  }),
  medications: z.object({
    name: z.string().trim().min(1).max(160),
    dose: z.string().max(80).optional(),
    frequency: z.string().max(80).optional(),
    route: z.string().max(40).optional(),
    startedAt: z.coerce.date().optional(),
    notes: z.string().max(500).optional(),
  }),
  immunisations: z.object({
    vaccine: z.string().trim().min(1).max(120),
    doseNumber: z.number().int().min(1).max(20).optional(),
    administeredAt: z.coerce.date().optional(),
    lotNumber: z.string().max(60).optional(),
    notes: z.string().max(500).optional(),
  }),
};

router.post(
  '/:patientId/record/:kind',
  ...clinicianOnly,
  asyncHandler(async (req, res) => {
    const { patientId, kind } = req.params;
    if (!isObjectId(patientId)) return res.status(400).json({ error: 'invalid_id' });
    const schema = listSchemas[kind];
    if (!schema) return res.status(400).json({ error: 'invalid_kind' });
    const data = schema.parse(req.body);

    const item = kind === 'vitals' ? { ...data, recordedBy: req.user._id } : data;
    const record = await PatientRecord.findOneAndUpdate(
      { patientId },
      {
        $push: { [kind]: item },
        $set: { lastReviewedAt: new Date(), lastReviewedBy: req.user._id },
        $setOnInsert: { patientId },
      },
      { new: true, upsert: true }
    ).lean();
    res.status(201).json({ record });
  })
);

router.delete(
  '/:patientId/record/:kind/:itemId',
  ...clinicianOnly,
  asyncHandler(async (req, res) => {
    const { patientId, kind, itemId } = req.params;
    if (!isObjectId(patientId) || !isObjectId(itemId)) return res.status(400).json({ error: 'invalid_id' });
    if (!listSchemas[kind]) return res.status(400).json({ error: 'invalid_kind' });
    const record = await PatientRecord.findOneAndUpdate(
      { patientId },
      { $pull: { [kind]: { _id: itemId } } },
      { new: true }
    ).lean();
    if (!record) return res.status(404).json({ error: 'record_not_found' });
    res.json({ record });
  })
);

// --- Visit notes ---------------------------------------------------------
const noteSchema = z.object({
  chiefComplaint: z.string().max(240).optional(),
  subjective: z.string().max(4000).optional(),
  objective: z.string().max(4000).optional(),
  assessment: z.string().max(4000).optional(),
  plan: z.string().max(4000).optional(),
  visitedAt: z.coerce.date().optional(),
  visibility: z.enum(['clinician_only', 'patient_visible']).optional(),
  vitalsSnapshot: z.object({
    temperatureC: z.number().min(25).max(45).optional(),
    heartRate: z.number().int().min(20).max(250).optional(),
    bloodPressureSystolic: z.number().int().min(40).max(260).optional(),
    bloodPressureDiastolic: z.number().int().min(20).max(200).optional(),
    spo2: z.number().int().min(30).max(100).optional(),
    weightKg: z.number().min(0).max(500).optional(),
  }).optional(),
});

router.post(
  '/appointments/:appointmentId/note',
  ...clinicianOnly,
  asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;
    if (!isObjectId(appointmentId)) return res.status(400).json({ error: 'invalid_id' });
    const data = noteSchema.parse(req.body);

    const appt = await Appointment.findById(appointmentId).lean();
    if (!appt) return res.status(404).json({ error: 'appointment_not_found' });
    if (!appt.patientId) return res.status(400).json({ error: 'guest_appointment_no_record' });

    const note = await VisitNote.create({
      appointmentId,
      patientId: appt.patientId,
      clinicianId: req.user._id,
      visitedAt: data.visitedAt || new Date(),
      chiefComplaint: data.chiefComplaint || '',
      subjective: data.subjective || '',
      objective: data.objective || '',
      assessment: data.assessment || '',
      plan: data.plan || '',
      vitalsSnapshot: data.vitalsSnapshot || {},
      visibility: data.visibility || 'patient_visible',
    });

    // Mirror vitals snapshot into the patient record so clinicians see one
    // continuous vitals timeline regardless of which UI captured the values.
    if (data.vitalsSnapshot && Object.keys(data.vitalsSnapshot).length) {
      await PatientRecord.updateOne(
        { patientId: appt.patientId },
        {
          $push: { vitals: { ...data.vitalsSnapshot, at: note.visitedAt, recordedBy: req.user._id } },
          $set: { lastReviewedAt: new Date(), lastReviewedBy: req.user._id },
          $setOnInsert: { patientId: appt.patientId },
        },
        { upsert: true }
      );
    }

    res.status(201).json({ note });
  })
);

router.get(
  '/appointments/:appointmentId/note',
  ...clinicianOnly,
  asyncHandler(async (req, res) => {
    const { appointmentId } = req.params;
    if (!isObjectId(appointmentId)) return res.status(400).json({ error: 'invalid_id' });
    const notes = await VisitNote.find({ appointmentId }).sort({ visitedAt: -1 }).lean();
    res.json({ notes });
  })
);

export default router;
