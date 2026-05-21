// Phase 5.1 — Appointment reminders.
//
// Runs every 5 minutes. Finds upcoming appointments in two windows:
//   * T-24h ± 5 min  (the "day before" reminder)
//   * T-1h  ± 5 min  (the "leaving now" reminder)
// Sends one reminder per (appointment, window) — `remindersSent.day/hour`
// stamps prevent re-sends if the cron is restarted or the job overlaps.
//
// Delivery strategy is intentionally lightweight: a Socket.io event to
// the patient's user room (`user:<id>`) — the client can show a toast or
// banner. When FCM is enabled (FCM_ENABLED=true) we additionally push;
// today FCM is stubbed in dev so we just log.
import cron from 'node-cron';
import { Appointment } from '../models/Appointment.js';
import { getIo } from '../realtime/io.js';
import { config } from '../config.js';
import { sendBulkSms } from '../services/sms.js';

const WINDOW_MS = 5 * 60_000;          // ± 5 minutes
const DAY_MS    = 24 * 60 * 60_000;
const HOUR_MS   =      60 * 60_000;

async function fireWindow({ field, msAhead, label }) {
  const now = Date.now();
  const target = new Date(now + msAhead);
  const lo = new Date(target.getTime() - WINDOW_MS);
  const hi = new Date(target.getTime() + WINDOW_MS);
  const filter = {
    status: 'waiting',
    patientId: { $ne: null },           // guest bookings have no socket room
    scheduledFor: { $gte: lo, $lte: hi },
    [`remindersSent.${field}`]: null,
  };
  const due = await Appointment.find(filter)
    .select('_id patientId clinicId scheduledFor ticketNumber')
    .populate('patientId', 'phone name')
    .populate('clinicId', 'name')
    .lean();
  if (due.length === 0) return 0;

  const io = getIo();
  for (const a of due) {
    io.to(`user:${a.patientId?._id || a.patientId}`).emit('appointment:reminder', {
      appointmentId: a._id,
      clinicId: a.clinicId?._id || a.clinicId,
      ticketNumber: a.ticketNumber,
      scheduledFor: a.scheduledFor,
      kind: label, // 'day' | 'hour'
    });
  }

  // Phase 5.2 \u2014 SMS reminders. Patients with a phone number get a one-line
  // SMS in addition to the socket event. The cron is the only sender so
  // dedupe via `remindersSent` already protects us from double-texting.
  const lead = label === 'day' ? 'tomorrow' : 'in ~1 hour';
  const smsBatch = due
    .filter((a) => a.patientId?.phone)
    .map((a) => ({
      to: a.patientId.phone,
      body: `AfyaConnect: reminder \u2014 your appointment at ${a.clinicId?.name || 'the clinic'} (ticket #${a.ticketNumber}) is ${lead}.`,
    }));
  if (smsBatch.length > 0) await sendBulkSms(smsBatch);

  await Appointment.updateMany(
    { _id: { $in: due.map((a) => a._id) } },
    { $set: { [`remindersSent.${field}`]: new Date() } }
  );
  console.log(`[reminders] sent ${due.length} ${label}-reminder(s)`);
  return due.length;
}

export async function runRemindersOnce() {
  // Exposed for tests + a manual /admin trigger if we ever need one.
  const day  = await fireWindow({ field: 'day',  msAhead: DAY_MS,  label: 'day'  });
  const hour = await fireWindow({ field: 'hour', msAhead: HOUR_MS, label: 'hour' });
  return { day, hour };
}

export function startReminderJob() {
  if (!config.features.reminders) {
    console.log('[jobs] reminders disabled');
    return null;
  }
  // Every 5 min on the wall clock. Window is also ±5 min so each appointment
  // is matched by exactly one tick most of the time, and remindersSent
  // de-dupes the rare overlap.
  return cron.schedule('*/5 * * * *', () => {
    runRemindersOnce().catch((err) => console.error('[reminders] failed:', err));
  });
}
