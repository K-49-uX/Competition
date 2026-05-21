import { Router } from 'express';
import { z } from 'zod';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getIo } from '../realtime/io.js';
import { sendPush } from '../services/fcm.js';

const router = Router();

const campaignSchema = z.object({
  title: z.string(),
  message: z.string(),
  audience: z.enum(['all', 'patients', 'clinicians', 'admins']).default('all'),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const audiences = ['all'];
    if (req.user.role === 'patient') audiences.push('patients');
    if (req.user.role === 'clinician') audiences.push('clinicians');
    if (req.user.role === 'admin') audiences.push('admins', 'clinicians', 'patients');
    const items = await Notification.find({
      type: { $in: ['campaign', 'alert'] },
      audience: { $in: audiences },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ notifications: items });
  })
);

router.get(
  '/sos',
  requireAuth,
  requireRole('clinician', 'admin'),
  asyncHandler(async (_req, res) => {
    const items = await Notification.find({ type: 'sos' })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ notifications: items });
  })
);

router.post(
  '/campaign',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const data = campaignSchema.parse(req.body);
    const note = await Notification.create({
      type: 'campaign',
      title: data.title,
      message: data.message,
      audience: data.audience,
      fromUserId: req.user._id,
    });

    getIo().emit('campaign:new', note);

    const filter = data.audience === 'all' ? {} : { role: data.audience.replace(/s$/, '') };
    const recipients = await User.find(filter).select('fcmTokens').lean();
    const tokens = recipients.flatMap((u) => u.fcmTokens || []);
    await sendPush(tokens, {
      notification: { title: data.title, body: data.message },
      data: { type: 'campaign', notificationId: String(note._id) },
    });

    res.status(201).json({ notification: note });
  })
);

export default router;
