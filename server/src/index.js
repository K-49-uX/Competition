import http from 'node:http';

import { config } from './config.js';
import { connectDb } from './db.js';
import { initIo } from './realtime/io.js';
import { initFcm } from './services/fcm.js';
import { startSnapshotJob } from './jobs/snapshotDaily.js';
import { startTransparencyJob } from './jobs/transparencyMonthly.js';
import { startReminderJob } from './jobs/reminders.js';
import { createApp } from './app.js';

const app = createApp();
const httpServer = http.createServer(app);
initIo(httpServer);

(async () => {
  try {
    await connectDb();
    await initFcm();
    startSnapshotJob();
    startTransparencyJob();
    startReminderJob();
    httpServer.listen(config.port, () => {
      console.log(`[server] listening on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('[server] failed to start:', err);
    process.exit(1);
  }
})();
