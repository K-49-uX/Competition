// Phase 3.5 — Self-onboarding for clinic admins.
//
// Public endpoints (no auth):
//   POST /api/onboarding/clinic/request   — submit application
//   GET  /api/onboarding/verify/:token    — applicant clicks email link
//
// Admin endpoints (super-admin only):
//   GET    /api/onboarding/applications              — list
//   POST   /api/onboarding/applications/:id/approve  — create Clinic + clinic_admin
//   POST   /api/onboarding/applications/:id/reject   — decline w/ reason
//
// Approval is the only path that mutates the live Clinic + User collections,
// so we audit it. Rejection is also audited so we can answer "why was X
// declined?" later.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { PendingClinicApplication } from '../models/PendingClinicApplication.js';
import { Clinic } from '../models/Clinic.js';
import { User } from '../models/User.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { recordAudit } from '../middleware/audit.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendEmail } from '../services/email.js';
import { config } from '../config.js';

const router = Router();
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^\+?\d{7,15}$/;

const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20, // per IP per hour — generous so legitimate retries succeed
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
});

const applicationSchema = z.object({
  clinicName: z.string().trim().min(2),
  address: z.string().trim().optional().default(''),
  hours: z.string().trim().optional().default('08:00 - 17:00'),
  services: z.array(z.string().trim()).optional().default([]),
  lng: z.number().optional(),
  lat: z.number().optional(),
  adminName: z.string().trim().min(2),
  adminEmail: z.string().trim().toLowerCase().regex(emailRe),
  adminPhone: z.string().trim().regex(phoneRe).optional().or(z.literal('')),
  password: z.string().min(8),
});

const rejectSchema = z.object({
  reason: z.string().trim().max(500).optional().default(''),
});

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ---------------------------------------------------------------------------
// Public: submit application
// ---------------------------------------------------------------------------
router.post(
  '/clinic/request',
  applyLimiter,
  asyncHandler(async (req, res) => {
    const data = applicationSchema.parse(req.body);

    // Block obvious dupes — same email already pending review.
    const existing = await PendingClinicApplication.findOne({
      adminEmail: data.adminEmail,
      status: { $in: ['pending', 'email_verified'] },
    });
    if (existing) return res.status(409).json({ error: 'application_pending' });

    // Reject if a real account already uses this email so reviewers don't
    // accidentally clobber an active clinic admin.
    const userExists = await User.findOne({ email: data.adminEmail });
    if (userExists) return res.status(409).json({ error: 'email_in_use' });

    const rawToken = crypto.randomBytes(24).toString('hex');
    const verifyTokenHash = hashToken(rawToken);
    const verifyTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const app = await PendingClinicApplication.create({
      clinicName: data.clinicName,
      address: data.address,
      hours: data.hours,
      services: data.services,
      location: {
        type: 'Point',
        coordinates: [Number(data.lng) || 0, Number(data.lat) || 0],
      },
      adminName: data.adminName,
      adminEmail: data.adminEmail,
      adminPhone: data.adminPhone || '',
      adminPasswordHash: passwordHash,
      verifyTokenHash,
      verifyTokenExpiresAt,
      status: 'pending',
    });

    const verifyUrl = `${config.publicAppUrl.replace(/\/$/, '')}/onboard-clinic/verify?token=${rawToken}`;
    const result = await sendEmail({
      to: data.adminEmail,
      subject: 'AfyaConnect — verify your clinic application',
      body: `Hi ${data.adminName},\n\nThanks for applying to join AfyaConnect with ${data.clinicName}. Please verify your email by visiting:\n\n${verifyUrl}\n\nThis link expires in 24 hours. After verification a member of our team will review your application.`,
    });

    const payload = { ok: true, id: app._id };
    // Dev convenience — same pattern as the OTP route. When email is stubbed
    // we expose the raw token so the smoke script can finish the flow
    // without an inbox.
    if (result.provider === 'stub') payload.devVerifyToken = rawToken;
    res.status(201).json(payload);
  })
);

// ---------------------------------------------------------------------------
// Public: verify email link
// ---------------------------------------------------------------------------
router.get(
  '/verify/:token',
  asyncHandler(async (req, res) => {
    const { token } = req.params;
    if (!token || token.length < 16) return res.status(400).json({ error: 'invalid_token' });
    const tokenHash = hashToken(token);
    const app = await PendingClinicApplication.findOne({
      verifyTokenHash: tokenHash,
      verifyTokenExpiresAt: { $gt: new Date() },
      status: 'pending',
    });
    if (!app) return res.status(400).json({ error: 'invalid_or_expired' });
    app.status = 'email_verified';
    app.verifyTokenHash = null;
    app.verifyTokenExpiresAt = null;
    await app.save();
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Admin: list applications (super-admin only)
// ---------------------------------------------------------------------------
router.get(
  '/applications',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || '').trim();
    const filter = {};
    if (['pending', 'email_verified', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }
    const items = await PendingClinicApplication.find(filter)
      .select('-adminPasswordHash -verifyTokenHash')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ items });
  })
);

// ---------------------------------------------------------------------------
// Admin: approve → create Clinic + clinic_admin User
// ---------------------------------------------------------------------------
router.post(
  '/applications/:id/approve',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const app = await PendingClinicApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'not_found' });
    if (app.status !== 'email_verified') {
      // Reviewer mistake — block approval until the applicant has verified
      // ownership of the email. Avoids creating credentials for someone
      // who never received the verification link.
      return res.status(409).json({ error: 'email_not_verified' });
    }
    if (await User.findOne({ email: app.adminEmail })) {
      return res.status(409).json({ error: 'email_in_use' });
    }

    const clinic = await Clinic.create({
      name: app.clinicName,
      address: app.address,
      hours: app.hours,
      services: app.services,
      location: app.location,
    });
    const adminUser = await User.create({
      name: app.adminName,
      email: app.adminEmail,
      phone: app.adminPhone || undefined,
      passwordHash: app.adminPasswordHash,
      role: 'clinic_admin',
      clinicId: clinic._id,
    });

    app.status = 'approved';
    app.reviewedBy = req.user._id;
    app.reviewedAt = new Date();
    app.createdClinicId = clinic._id;
    app.createdAdminId = adminUser._id;
    await app.save();

    await recordAudit({
      action: 'onboarding.approve',
      req,
      resource: 'PendingClinicApplication',
      resourceId: app._id,
      metadata: { clinicId: clinic._id, adminUserId: adminUser._id, adminEmail: app.adminEmail },
    });

    // Best-effort welcome notice. Failure here doesn't block approval.
    sendEmail({
      to: app.adminEmail,
      subject: 'AfyaConnect — your clinic is approved',
      body: `Welcome ${app.adminName}! ${app.clinicName} is now live on AfyaConnect. Sign in at ${config.publicAppUrl} with the email and password you registered.`,
    }).catch(() => {});

    res.json({ ok: true, clinicId: clinic._id, adminUserId: adminUser._id });
  })
);

// ---------------------------------------------------------------------------
// Admin: reject
// ---------------------------------------------------------------------------
router.post(
  '/applications/:id/reject',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { reason } = rejectSchema.parse(req.body || {});
    const app = await PendingClinicApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'not_found' });
    if (app.status === 'approved' || app.status === 'rejected') {
      return res.status(409).json({ error: 'already_reviewed' });
    }
    app.status = 'rejected';
    app.reviewedBy = req.user._id;
    app.reviewedAt = new Date();
    app.rejectionReason = reason;
    await app.save();
    await recordAudit({
      action: 'onboarding.reject',
      req,
      resource: 'PendingClinicApplication',
      resourceId: app._id,
      metadata: { reason, adminEmail: app.adminEmail },
    });
    res.json({ ok: true });
  })
);

export default router;
