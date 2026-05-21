import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

const tokenSchema = z.object({ token: z.string().min(10) });

router.post(
  '/fcm-token',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token } = tokenSchema.parse(req.body);
    await User.updateOne(
      { _id: req.user._id },
      { $addToSet: { fcmTokens: token } }
    );
    res.json({ ok: true });
  })
);

router.delete(
  '/fcm-token',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { token } = tokenSchema.parse(req.body);
    await User.updateOne(
      { _id: req.user._id },
      { $pull: { fcmTokens: token } }
    );
    res.json({ ok: true });
  })
);

const profileSchema = z.object({
  name: z.string().optional(),
  language: z.enum(['en', 'sw', 'fr', 'ar']).optional(),
  avatarUrl: z
    .string()
    .max(800_000, 'avatar_too_large')
    .refine(
      (v) => v === '' || /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v),
      { message: 'invalid_avatar_format' }
    )
    .optional(),
});

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = profileSchema.parse(req.body);
    Object.assign(req.user, data);
    await req.user.save();
    res.json({ user: req.user.toSafeJSON() });
  })
);

export default router;
