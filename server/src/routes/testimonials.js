import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { Testimonial } from '../models/Testimonial.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

// Public list — only approved testimonials, featured first. Cached lightly
// so a sudden press spike doesn't hammer Mongo.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { language, role, limit } = z.object({
      language: z.enum(['en', 'sw', 'fr', 'ar']).optional(),
      role: z.enum(['patient', 'family', 'clinician', 'partner', 'donor', 'other']).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(12),
    }).parse(req.query);

    const filter = { status: 'approved' };
    if (language) filter.language = language;
    if (role) filter.role = role;

    const items = await Testimonial.find(filter)
      .sort({ featured: -1, createdAt: -1 })
      .limit(limit)
      .select('-submitterIpHash -submittedByUserId -moderatedBy -moderationNotes')
      .lean();

    res.set('Cache-Control', 'public, max-age=120');
    res.json({ testimonials: items });
  })
);

// Public submission. Authenticated requests get linked to the user; guests
// can also submit (low friction = more stories) but their IP hash is captured
// for abuse moderation only.
const submitSchema = z.object({
  name: z.string().trim().min(2).max(80),
  role: z.enum(['patient', 'family', 'clinician', 'partner', 'donor', 'other']).default('patient'),
  location: z.string().trim().max(80).optional(),
  language: z.enum(['en', 'sw', 'fr', 'ar']).default('en'),
  quote: z.string().trim().min(30).max(1000),
  photoUrl: z.string().url().max(500).optional().or(z.literal('')),
  consent: z.literal(true, { errorMap: () => ({ message: 'consent_required' }) }),
  consentText: z.string().min(10).max(500),
});

router.post(
  '/',
  submitLimiter,
  asyncHandler(async (req, res) => {
    const data = submitSchema.parse(req.body);

    // Optional auth — if a token is present we link the submission, but no token
    // is fine. We don't reject either way.
    let userId = null;
    try {
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        const { default: jwt } = await import('jsonwebtoken');
        const decoded = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
        userId = decoded?.id || decoded?.sub || null;
      }
    } catch { /* ignore — guest submission */ }

    const ip = (req.headers['x-forwarded-for']?.split(',')[0]?.trim()) || req.ip || '';
    const t = await Testimonial.create({
      name: data.name,
      role: data.role,
      location: data.location || '',
      language: data.language,
      quote: data.quote,
      photoUrl: data.photoUrl || '',
      consentGivenAt: new Date(),
      consentText: data.consentText,
      submitterIpHash: Testimonial.hashIp(ip),
      submittedByUserId: userId,
      status: 'pending',
    });

    res.status(201).json({
      ok: true,
      id: t._id,
      message: 'Thank you. Your story is awaiting review.',
    });
  })
);

// --- admin moderation ---
router.get(
  '/admin',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { status, limit } = z.object({
      status: z.enum(['pending', 'approved', 'rejected', 'withdrawn', 'all']).default('pending'),
      limit: z.coerce.number().int().min(1).max(200).default(100),
    }).parse(req.query);

    const filter = status === 'all' ? {} : { status };
    const items = await Testimonial.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-submitterIpHash')
      .lean();
    const counts = await Testimonial.aggregate([
      { $group: { _id: '$status', n: { $sum: 1 } } },
    ]);
    res.json({
      testimonials: items,
      counts: counts.reduce((acc, c) => Object.assign(acc, { [c._id]: c.n }), {}),
    });
  })
);

router.patch(
  '/admin/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const id = req.params.id;
    const patch = z.object({
      status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']).optional(),
      featured: z.boolean().optional(),
      moderationNotes: z.string().max(500).optional(),
      // Allow light edits (typo fixes) — but we never silently change the quote
      // without an audit field. moderationNotes should record the reason.
      quote: z.string().trim().min(30).max(1000).optional(),
      name: z.string().trim().min(2).max(80).optional(),
      location: z.string().trim().max(80).optional(),
    }).parse(req.body);

    const update = { ...patch };
    if (patch.status) {
      update.moderatedAt = new Date();
      update.moderatedBy = req.user?.id || req.user?._id || null;
    }

    const t = await Testimonial.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!t) return res.status(404).json({ error: 'not_found' });
    res.json({ testimonial: t });
  })
);

router.delete(
  '/admin/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const result = await Testimonial.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'not_found' });
    res.json({ ok: true });
  })
);

export default router;
