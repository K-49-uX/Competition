import { User } from '../models/User.js';
import { Clinic } from '../models/Clinic.js';
import { Appointment } from '../models/Appointment.js';
import { Notification } from '../models/Notification.js';
import { EducationContent } from '../models/EducationContent.js';
import { MetricSnapshot } from '../models/MetricSnapshot.js';

// Compute today's snapshot from live collections and upsert by day. Idempotent
// — running it multiple times the same UTC day just refreshes the row.
//
// Designed so that even if it fails (e.g. one collection is empty) it falls
// back to safe zeros rather than throwing — we never want metrics work to
// take the API down.
export async function buildSnapshot(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const startOfDay = new Date(`${day}T00:00:00.000Z`);
  const startOfNextDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const startOf30dWindow = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const safe = (p) => p.catch((err) => { console.warn('[metrics] subquery failed:', err?.message); return null; });

  const [
    patientsTotal,
    patientsNewToday,
    appointmentsTotal,
    appointmentsToday,
    appointmentsCompletedToday,
    sosTotal,
    sosToday,
    clinics,
    educationTopics,
    languages,
    byClinic,
    byLanguage,
    waitAgg,
  ] = await Promise.all([
    safe(User.countDocuments({ role: 'patient' })),
    safe(User.countDocuments({ role: 'patient', createdAt: { $gte: startOfDay, $lt: startOfNextDay } })),
    safe(Appointment.countDocuments({})),
    safe(Appointment.countDocuments({ createdAt: { $gte: startOfDay, $lt: startOfNextDay } })),
    safe(Appointment.countDocuments({ status: 'completed', updatedAt: { $gte: startOfDay, $lt: startOfNextDay } })),
    safe(Notification.countDocuments({ type: 'sos' })),
    safe(Notification.countDocuments({ type: 'sos', createdAt: { $gte: startOfDay, $lt: startOfNextDay } })),
    safe(Clinic.countDocuments({})),
    safe(EducationContent.distinct('slug').then((s) => s.length)),
    safe(User.distinct('language').then((l) => l.filter(Boolean).length)),
    safe(
      Appointment.aggregate([
        { $match: { createdAt: { $gte: startOf30dWindow } } },
        { $group: { _id: '$clinicId', appointments: { $sum: 1 } } },
        { $lookup: { from: 'clinics', localField: '_id', foreignField: '_id', as: 'clinic' } },
        { $unwind: { path: '$clinic', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, clinicId: { $toString: '$_id' }, name: '$clinic.name', appointments: 1 } },
        { $sort: { appointments: -1 } },
        { $limit: 25 },
      ])
    ),
    safe(
      User.aggregate([
        { $match: { role: 'patient' } },
        { $group: { _id: '$language', users: { $sum: 1 } } },
        { $project: { _id: 0, lang: { $ifNull: ['$_id', 'unknown'] }, users: 1 } },
        { $sort: { users: -1 } },
      ])
    ),
    safe(
      Appointment.aggregate([
        { $match: { status: 'completed', updatedAt: { $gte: startOf30dWindow }, createdAt: { $exists: true } } },
        { $project: { waitMs: { $subtract: ['$updatedAt', '$createdAt'] } } },
        { $group: { _id: null, avgMs: { $avg: '$waitMs' } } },
      ])
    ),
  ]);

  const counts = {
    patientsTotal: patientsTotal || 0,
    patientsNewToday: patientsNewToday || 0,
    appointmentsTotal: appointmentsTotal || 0,
    appointmentsToday: appointmentsToday || 0,
    appointmentsCompletedToday: appointmentsCompletedToday || 0,
    sosTotal: sosTotal || 0,
    sosToday: sosToday || 0,
    clinics: clinics || 0,
    educationTopics: educationTopics || 0,
    languagesServed: languages || 0,
  };
  const avgWaitMs = waitAgg?.[0]?.avgMs || 0;
  const averages = { waitMinutes: Math.round(avgWaitMs / 60000) };

  const breakdown = {
    byClinic: byClinic || [],
    byLanguage: byLanguage || [],
  };

  const snap = await MetricSnapshot.findOneAndUpdate(
    { day },
    { $set: { counts, averages, breakdown } },
    { new: true, upsert: true }
  );
  return snap;
}

// Read the latest snapshot (or build one if there are none yet). Used by the
// public Impact endpoint so first-page-load works even on a fresh deploy.
export async function getLatestSnapshot() {
  const latest = await MetricSnapshot.findOne({}).sort({ day: -1 }).lean();
  if (latest) return latest;
  const built = await buildSnapshot();
  return built.toObject ? built.toObject() : built;
}

// Last N daily snapshots in ascending-by-day order, for trend charts.
export async function getTrend(days = 30) {
  return MetricSnapshot.find({}).sort({ day: -1 }).limit(days).lean()
    .then((rows) => rows.reverse());
}
