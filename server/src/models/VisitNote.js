import mongoose from 'mongoose';

// One note per clinical encounter. Linked to an Appointment and to the
// patient (denormalised so we can index/query by patient without joining).
// SOAP-style optional fields plus a free-text body for partial workflows.
const visitNoteSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clinicianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    visitedAt: { type: Date, default: Date.now },

    chiefComplaint: { type: String, default: '', trim: true, maxlength: 240 },
    subjective: { type: String, default: '', maxlength: 4000 },
    objective: { type: String, default: '', maxlength: 4000 },
    assessment: { type: String, default: '', maxlength: 4000 },
    plan: { type: String, default: '', maxlength: 4000 },

    // Vitals captured during this visit (also pushed to PatientRecord.vitals).
    vitalsSnapshot: {
      temperatureC: Number,
      heartRate: Number,
      bloodPressureSystolic: Number,
      bloodPressureDiastolic: Number,
      spo2: Number,
      weightKg: Number,
    },

    visibility: {
      type: String,
      enum: ['clinician_only', 'patient_visible'],
      default: 'patient_visible',
    },
  },
  { timestamps: true }
);

visitNoteSchema.index({ patientId: 1, visitedAt: -1 });

export const VisitNote = mongoose.model('VisitNote', visitNoteSchema);
