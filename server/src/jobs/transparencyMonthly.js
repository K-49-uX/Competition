import cron from 'node-cron';
import { config } from '../config.js';
import { previousMonth, publishReport } from '../services/transparency.js';
import { TransparencyReport } from '../models/TransparencyReport.js';

// Auto-publish last month's transparency report on the 1st at 06:05 UTC.
// Also runs once at boot if the previous month's report hasn't been
// published yet — handy after deploys around month-boundary or first install.
export function startTransparencyJob() {
  if (!config.features.transparency) return null;

  const publishLastMonth = async () => {
    try {
      const { year, month } = previousMonth();
      await publishReport(year, month);
      console.log(`[jobs] transparency report published for ${year}-${String(month).padStart(2, '0')}`);
    } catch (err) {
      console.warn('[jobs] transparency publish failed:', err?.message);
    }
  };

  // Boot-time backfill: only publish if missing, so we don't churn the row.
  setImmediate(async () => {
    try {
      const { year, month } = previousMonth();
      const existing = await TransparencyReport.findOne({ year, month }).lean();
      if (!existing) await publishLastMonth();
    } catch (err) {
      console.warn('[jobs] transparency boot-check failed:', err?.message);
    }
  });

  return cron.schedule('5 6 1 * *', publishLastMonth, { timezone: 'UTC' });
}
