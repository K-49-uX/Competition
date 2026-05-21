import cron from 'node-cron';
import { buildSnapshot } from '../services/metrics.js';
import { config } from '../config.js';

// Runs at 00:05 UTC every day. Also kicks off once at boot so a fresh deploy
// has a snapshot to serve from /api/metrics/public immediately.
export function startSnapshotJob() {
  if (!config.features.metricsSnapshot) {
    console.log('[jobs] metrics snapshot disabled');
    return null;
  }

  // Boot-time build (non-blocking). If it fails we just log and keep going —
  // the API endpoint itself can lazily build on first request.
  buildSnapshot()
    .then((s) => console.log(`[jobs] initial metrics snapshot built for ${s.day}`))
    .catch((err) => console.warn('[jobs] initial metrics snapshot failed:', err?.message));

  const task = cron.schedule(
    '5 0 * * *',
    async () => {
      try {
        const s = await buildSnapshot();
        console.log(`[jobs] daily metrics snapshot built for ${s.day}`);
      } catch (err) {
        console.error('[jobs] daily metrics snapshot failed:', err);
      }
    },
    { timezone: 'UTC' }
  );
  return task;
}
