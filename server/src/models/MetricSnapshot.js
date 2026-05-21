import mongoose from 'mongoose';

// Daily aggregate snapshot. One document per UTC day. Read by the public
// Impact Dashboard, the monthly Transparency PDF, and the press kit fact
// sheet. Computed by jobs/snapshotDaily.js so the public API never has to
// run a heavy aggregation at request time.
const metricSnapshotSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, unique: true, index: true }, // YYYY-MM-DD UTC
    counts: {
      patientsTotal: { type: Number, default: 0 },
      patientsNewToday: { type: Number, default: 0 },
      appointmentsTotal: { type: Number, default: 0 },
      appointmentsToday: { type: Number, default: 0 },
      appointmentsCompletedToday: { type: Number, default: 0 },
      sosTotal: { type: Number, default: 0 },
      sosToday: { type: Number, default: 0 },
      clinics: { type: Number, default: 0 },
      educationTopics: { type: Number, default: 0 },
      languagesServed: { type: Number, default: 0 },
    },
    averages: {
      waitMinutes: { type: Number, default: 0 }, // computed across last 30 days
    },
    breakdown: {
      byClinic: { type: [{ clinicId: String, name: String, appointments: Number }], default: [] },
      byLanguage: { type: [{ lang: String, users: Number }], default: [] },
    },
  },
  { timestamps: true }
);

export const MetricSnapshot = mongoose.model('MetricSnapshot', metricSnapshotSchema);
