import mongoose from 'mongoose';

// One row per published monthly transparency report. The actual content is
// regenerated on demand from MetricSnapshot history (so we never have stale
// numbers), but this row captures publication metadata + a frozen summary so
// the public archive page is fast and consistent even if the underlying
// snapshots get re-run.
const transparencyReportSchema = new mongoose.Schema(
  {
    period: { type: String, required: true, unique: true, index: true }, // YYYY-MM
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    publishedAt: { type: Date, default: Date.now },
    summary: {
      patientsServed: { type: Number, default: 0 },
      appointments: { type: Number, default: 0 },
      sosResponses: { type: Number, default: 0 },
      newPatients: { type: Number, default: 0 },
      clinicsActive: { type: Number, default: 0 },
      languagesServed: { type: Number, default: 0 },
      avgWaitMinutes: { type: Number, default: 0 },
    },
    breakdown: {
      byClinic: [{ name: String, appointments: Number }],
      byLanguage: [{ lang: String, users: Number }],
    },
    notes: { type: String, default: '' },
    visibility: { type: String, enum: ['public', 'draft'], default: 'public' },
  },
  { timestamps: true }
);

export const TransparencyReport = mongoose.model('TransparencyReport', transparencyReportSchema);
