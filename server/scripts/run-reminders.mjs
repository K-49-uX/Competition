// Manually fire the appointment-reminder cron once and print the result.
//   node server/scripts/run-reminders.mjs
import 'dotenv/config';
import mongoose from 'mongoose';
import { runRemindersOnce } from '../src/jobs/reminders.js';
import { initIo } from '../src/realtime/io.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  // The job emits over Socket.io. We don't have a real http server here, so
  // initialise a no-op io shim — the emits become no-ops but SMS/log still run.
  try { initIo({ on() {}, of() { return { emit() {} }; }, to() { return { emit() {} }; } }); } catch {}
  const res = await runRemindersOnce();
  console.log('[run-reminders] result:', res);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
