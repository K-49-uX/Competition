import { Router } from 'express';
import { EducationContent } from '../models/EducationContent.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const LANGS = ['en', 'sw', 'fr', 'ar'];
function pickLang(q) {
  return LANGS.includes(q) ? q : 'en';
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const lang = pickLang(req.query.lang);
    const filter = {};
    if (req.query.category) filter.category = req.query.category;

    // Fetch in requested language + English (used as fallback)
    const docs = await EducationContent.find({
      ...filter,
      language: { $in: [lang, 'en'] },
    })
      .select('slug category icon title body language')
      .lean();

    // Prefer requested language; fall back to English when a slug has no translation
    const bySlug = new Map();
    for (const d of docs) {
      const existing = bySlug.get(d.slug);
      if (!existing || (existing.language !== lang && d.language === lang)) {
        bySlug.set(d.slug, d);
      }
    }
    res.json({ items: Array.from(bySlug.values()) });
  })
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const lang = pickLang(req.query.lang);
    let item = await EducationContent.findOne({ slug: req.params.slug, language: lang }).lean();
    if (!item) {
      // fallback to English so a missing translation still works
      item = await EducationContent.findOne({ slug: req.params.slug, language: 'en' }).lean();
    }
    if (!item) return res.status(404).json({ error: 'not_found' });
    res.json({ item });
  })
);

export default router;
