import mongoose from 'mongoose';

// One prescribed item. Kept flat (rather than referencing a drug catalogue)
// because clinicians need free-text fallback for paediatric dosing notes
// and for medications outside any standard formulary we might add later.
const itemSchema = new mongoose.Schema(
  {
    drug:          { type: String, required: true, trim: true, maxlength: 160 },
    dose:          { type: String, trim: true, maxlength: 80 },     // "500mg"
    frequency:     { type: String, trim: true, maxlength: 80 },     // "BID"
    route:         { type: String, trim: true, maxlength: 40, default: 'oral' },
    durationDays:  { type: Number, min: 1, max: 365 },
    quantity:      { type: String, trim: true, maxlength: 60 },     // "30 tablets"
    instructions:  { type: String, trim: true, maxlength: 500 },    // "after meals"
  },
  { _id: true }
);

const prescriptionSchema = new mongoose.Schema(
  {
    // Sequential per clinic per year. Computed at create time so we never
    // need to backfill if numbers grow gappy on race-conditions (the unique
    // compound index forces a retry rather than silently reusing).
    prescriptionNumber: { type: Number, required: true },
    year:               { type: Number, required: true },

    clinicId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic',      required: true, index: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', index: true },
    patientId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',        index: true },

    // Snapshot patient + clinician details at time of issue so reprinting
    // years later still shows the historically accurate name/role/phone.
    patientName:   { type: String, required: true, trim: true, maxlength: 200 },
    patientAge:    Number,
    patientSex:    String,
    patientPhone:  { type: String, trim: true, maxlength: 40 },

    prescriberId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    prescriberName:  { type: String, required: true, trim: true, maxlength: 200 },
    prescriberRole:  { type: String, default: 'clinician', maxlength: 60 },

    diagnosis: { type: String, trim: true, maxlength: 500 },
    items:     { type: [itemSchema], validate: (v) => v.length > 0 && v.length <= 30 },
    notes:     { type: String, trim: true, maxlength: 1000 },
    issuedAt:  { type: Date, default: Date.now },
  },
  { timestamps: true }
);

prescriptionSchema.index({ clinicId: 1, year: 1, prescriptionNumber: 1 }, { unique: true });

export const Prescription = mongoose.model('Prescription', prescriptionSchema);
