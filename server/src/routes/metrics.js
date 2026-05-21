import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildSnapshot, getLatestSnapshot, getTrend } from '../services/metrics.js';

const router = Router();

// Public endpoint powering the Impact Dashboard. Returns aggregate counts only
// — never raw user/appointment data, so no anonymisation work needed here.
router.get(
  '/public',
  asyncHandler(async (_req, res) => {
    const [snapshot, trend] = await Promise.all([getLatestSnapshot(), getTrend(30)]);
    res.json({
      day: snapshot.day,
      counts: snapshot.counts,
      averages: snapshot.averages,
      languagesServed: snapshot.counts.languagesServed,
      trend: trend.map((t) => ({
        day: t.day,
        appointments: t.counts.appointmentsToday,
        sos: t.counts.sosToday,
        newPatients: t.counts.patientsNewToday,
      })),
    });
  })
);

// Admin/clinician deep view including per-clinic + per-language breakdowns.
router.get(
  '/admin',
  requireAuth,
  requireRole('admin', 'clinician'),
  asyncHandler(async (_req, res) => {
    const [snapshot, trend] = await Promise.all([getLatestSnapshot(), getTrend(90)]);
    res.json({ snapshot, trend });
  })
);

// Manual refresh — handy for admins after big imports / migrations.
router.post(
  '/snapshot',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const snap = await buildSnapshot();
    res.json({ ok: true, snapshot: snap });
  })
);

export default router;
