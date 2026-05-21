import mongoose from 'mongoose';

// Lite EHR per patient. One document per User (patient role) — created lazily
// the first time a clinician opens the patient's record. Existing patients
// continue to work without one (the route returns an empty shell).
//
// All write surfaces in this model are clinician-only and audited at the
// route layer. Patients see a redacted read-only view via /api/me/record.

const vitalSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, required: true },
    heightCm: { type: Number, min: 0, max: 300 },
    weightKg: { type: Number, min: 0, max: 500 },
    temperatureC: { type: Number, min: 25, max: 45 },
    heartRate: { type: Number, min: 20, max: 250 },
    respiratoryRate: { type: Number, min: 4, max: 80 },
    bloodPressureSystolic: { type: Number, min: 40, max: 260 },
    bloodPressureDiastolic: { type: Number, min: 20, max: 200 },
    spo2: { type: Number, min: 30, max: 100 },
    notes: { type: String, default: '', maxlength: 500 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const allergySchema = new mongoose.Schema(
  {
    substance: { type: String, required: true, trim: true, maxlength: 120 },
    reaction: { type: String, default: '', trim: true, maxlength: 240 },
    severity: { type: String, enum: ['mild', 'moderate', 'severe', 'life-threatening'], default: 'mild' },
    notedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const conditionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    icd10: { type: String, default: '', uppercase: true, trim: true, maxlength: 12 },
    status: { type: String, enum: ['active', 'resolved', 'remission'], default: 'active' },
    diagnosedAt: { type: Date },
    resolvedAt: { type: Date, default: null },
    notes: { type: String, default: '', maxlength: 500 },
  },
  { _id: true }
);

const medicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    dose: { type: String, default: '', trim: true, maxlength: 80 },     // e.g. 500mg
    frequency: { type: String, default: '', trim: true, maxlength: 80 }, // e.g. BID
    route: { type: String, default: 'oral', maxlength: 40 },
    startedAt: { type: Date, default: Date.now },
    stoppedAt: { type: Date, default: null },
    notes: { type: String, default: '', maxlength: 500 },
  },
  { _id: true }
);

const immunisationSchema = new mongoose.Schema(
  {
    vaccine: { type: String, required: true, trim: true, maxlength: 120 },
    doseNumber: { type: Number, default: 1, min: 1, max: 20 },
    administeredAt: { type: Date, default: Date.now },
    lotNumber: { type: String, default: '', maxlength: 60 },
    notes: { type: String, default: '', maxlength: 500 },
  },
  { _id: true }
);

const patientRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'], default: 'unknown' },
    vitals: { type: [vitalSchema], default: [] },
    allergies: { type: [allergySchema], default: [] },
    conditions: { type: [conditionSchema], default: [] },
    medications: { type: [medicationSchema], default: [] },
    immunisations: { type: [immunisationSchema], default: [] },

    // High-level summary clinicians can free-text. Capped to keep the doc small.
    summary: { type: String, default: '', maxlength: 2000 },
    lastReviewedAt: { type: Date, default: null },
    lastReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export const PatientRecord = mongoose.model('PatientRecord', patientRecordSchema);
