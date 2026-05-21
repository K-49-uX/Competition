import mongoose from 'mongoose';

// Severity ordering used for triage prioritisation. The numeric values are
// referenced by aggregation/sort code so callers don't have to repeat the
// switch. Higher number = more urgent.
export const SEVERITY_ORDER = {
  none:     0,
  low:      1,
  moderate: 2,
  high:     3,
  critical: 4,
};

// Patient-facing red-flag symptoms used during booking. If any of these are
// reported, we pre-fill triage.severity with a conservative suggestion so
// clinicians see flagged appointments first. Clinicians always confirm.
export const RED_FLAG_SYMPTOMS = {
  chest_pain:           'high',
  difficulty_breathing: 'high',
  severe_bleeding:      'critical',
  stroke_signs:         'critical',
  unconscious:          'critical',
  pregnancy_emergency:  'high',
  severe_pain:          'moderate',
  high_fever_child:     'high',
  recent_injury:        'moderate',
  vomiting_diarrhea:    'low',
};

export function suggestSeverityFromSymptoms(symptoms = []) {
  let best = 'none';
  for (const s of symptoms) {
    const sev = RED_FLAG_SYMPTOMS[s];
    if (sev && SEVERITY_ORDER[sev] > SEVERITY_ORDER[best]) best = sev;
  }
  return best;
}

const triageSchema = new mongoose.Schema(
  {
    severity: {
      type: String,
      enum: ['none', 'low', 'moderate', 'high', 'critical'],
      default: 'none',
      index: true,
    },
    // Patient self-reported red-flag symptoms during booking. Stored as
    // canonical keys (see RED_FLAG_SYMPTOMS) so the UI can localise labels.
    selfReportedSymptoms: { type: [String], default: [] },
    notes: { type: String, trim: true, maxlength: 1000 },
    assessedAt: Date,
    assessedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

// Tele-consult metadata. We deliberately store the room name only — never
// patient PHI — so a leaked join URL still requires the appointment record
// to map back to a person. Provider is fixed to Jitsi today but kept open
// so we can swap to a self-hosted JaaS / Whereby instance later.
const teleconsultSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    provider: { type: String, enum: ['jitsi'], default: 'jitsi' },
    roomName: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: Date,
    joinedClinicianAt: Date,
    joinedPatientAt: Date,
    endedAt: Date,
  },
  { _id: false }
);

const guestSchema = new mongoose.Schema(
  {
    patientName:   { type: String, required: true, trim: true },
    patientAge:    { type: Number, min: 0, max: 130 },
    patientSex:    { type: String, enum: ['female', 'male', 'other', 'prefer_not_say'] },
    patientPhone:  { type: String, trim: true },
    nationality:   { type: String, trim: true },
    blockOrCamp:   { type: String, trim: true },
    preferredLang: { type: String, trim: true },
    helperName:    { type: String, trim: true },
    helperPhone:   { type: String, trim: true },
    relationship:  { type: String, trim: true },
  },
  { _id: false }
);

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    guest: { type: guestSchema, default: undefined },
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic', required: true, index: true },
    scheduledFor: { type: Date, required: true },
    ticketNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: ['waiting', 'serving', 'completed', 'cancelled'],
      default: 'waiting',
      index: true,
    },
    reason: String,
    triage: { type: triageSchema, default: () => ({}) },
    teleconsult: { type: teleconsultSchema, default: () => ({}) },
    // Tracks which reminders the cron has already sent so the same patient
    // is never paged twice for the same window. Phase 5.1.
    remindersSent: {
      day:  { type: Date, default: null }, // T-24h
      hour: { type: Date, default: null }, // T-1h
    },
  },
  { timestamps: true }
);

appointmentSchema.pre('validate', function (next) {
  if (!this.patientId && !this.guest) {
    return next(new Error('appointment requires patientId or guest details'));
  }
  next();
});

export const Appointment = mongoose.model('Appointment', appointmentSchema);
