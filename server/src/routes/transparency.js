import { Router } from 'express';
import { z } from 'zod';
import { TransparencyReport } from '../models/TransparencyReport.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { buildReportData, publishReport, renderHtml } from '../services/transparency.js';

const router = Router();

const periodSchema = z.object({
  year: z.coerce.number().int().min(2024).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const reports = await TransparencyReport
      .find({ visibility: 'public' })
      .sort({ year: -1, month: -1 })
      .limit(60)
      .lean();
    res.json({
      reports: reports.map((r) => ({
        period: r.period,
        year: r.year,
        month: r.month,
        publishedAt: r.publishedAt,
        summary: r.summary,
      })),
    });
  })
);

router.get(
  '/:year/:month',
  asyncHandler(async (req, res) => {
    const { year, month } = periodSchema.parse(req.params);
    const data = await buildReportData(year, month);
    res.json(data);
  })
);

// Print-friendly HTML report. Donors save-as-PDF from their browser. When
// pdfkit installs cleanly we'll add /:year/:month/pdf alongside this.
router.get(
  '/:year/:month/html',
  asyncHandler(async (req, res) => {
    const { year, month } = periodSchema.parse(req.params);
    const data = await buildReportData(year, month);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(renderHtml(data));
  })
);

router.post(
  '/publish',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { year, month, notes } = z.object({
      year: z.number().int().min(2024).max(2100),
      month: z.number().int().min(1).max(12),
      notes: z.string().max(1000).optional(),
    }).parse(req.body);
    const report = await publishReport(year, month, { notes });
    res.status(201).json({ report });
  })
);

export default router;
