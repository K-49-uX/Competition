// Run the full seed only when the database has no clinics yet.
// Safe to put in the build command: first deploy seeds, later deploys no-op.
import { connectDb, disconnectDb } from '../src/db.js';
import { Clinic } from '../src/models/Clinic.js';

const count = await (async () => {
  await connectDb();
  try {
    return await Clinic.countDocuments();
  } finally {
    await disconnectDb();
  }
})();

if (count > 0) {
  console.log(`[seed-if-empty] ${count} clinics already exist; skipping seed.`);
  process.exit(0);
}

console.log('[seed-if-empty] empty database detected; running full seed...');
await import('../src/seed.js');
