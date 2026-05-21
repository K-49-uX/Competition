import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { Clinic } from '../models/Clinic.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getIo } from '../realtime/io.js';
import { sendPush } from '../services/fcm.js';
import { sendBulkSms } from '../services/sms.js';

const router = Router();

const sosLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 });

const sosSchema = z.object({
  message: z.string().optional(),
  lng: z.number().optional(),
  lat: z.number().optional(),
  address: z.string().trim().min(3, 'address_required').max(500),
  clinicId: z.string().min(1, 'clinic_required'),
});

router.post(
  '/',
  requireAuth,
  sosLimiter,
  asyncHandler(async (req, res) => {
    const parsed = sosSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'validation_failed',
        issues: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const data = parsed.data;

    const clinic = await Clinic.findById(data.clinicId).select('name address').lean();
    if (!clinic) return res.status(404).json({ error: 'clinic_not_found' });

    const note = await Notification.create({
      type: 'sos',
      title: 'EMERGENCY SOS',
      message: data.message || `SOS from ${req.user.name}`,
      fromUserId: req.user._id,
      clinicId: clinic._id,
      audience: 'clinicians',
      payload: {
        phone: req.user.phone,
        name: req.user.name,
        clinicName: clinic.name,
        address: data.address,
      },
      location: data.lng != null && data.lat != null
        ? { type: 'Point', coordinates: [data.lng, data.lat] }
        : undefined,
    });

    const event = {
      id: note._id,
      from: { id: req.user._id, name: req.user.name, phone: req.user.phone },
      clinic: { id: clinic._id, name: clinic.name, address: clinic.address },
      message: note.message,
      address: data.address,
      location: note.location,
      createdAt: note.createdAt,
    };
    // Broadcast to staff at the chosen clinic, plus all admins as a safety net.
    getIo()
      .to(`clinic:${clinic._id}`)
      .to('role:admin')
      .emit('sos:new', event);

    // Push to clinicians at that clinic + all admins with FCM tokens
    const responders = await User.find({
      $or: [
        { role: 'admin' },
        { role: 'clinician', clinicId: clinic._id },
      ],
    })
      .select('fcmTokens phone')
      .lean();
    const tokens = responders.flatMap((u) => u.fcmTokens || []);
    await sendPush(tokens, {
      notification: {
        title: `EMERGENCY SOS — ${clinic.name}`,
        body: `${event.message} • ${data.address}`,
      },
      data: {
        type: 'sos',
        notificationId: String(note._id),
        clinicId: String(clinic._id),
        address: data.address,
      },
    });

    // Phase 5.2 — SMS fan-out to responders that have a phone number.
    // Twilio in prod, console stub in dev/tests. Failures are logged inside
    // sendBulkSms and never bubble up.
    const smsBatch = responders
      .filter((u) => u.phone)
      .map((u) => ({
        to: u.phone,
        body: `AfyaConnect SOS — ${clinic.name}: ${event.message} @ ${data.address}`,
      }));
    if (smsBatch.length > 0) await sendBulkSms(smsBatch);

    res.status(201).json({ notification: note, clinic: { name: clinic.name, address: clinic.address } });
  })
);

export default router;
