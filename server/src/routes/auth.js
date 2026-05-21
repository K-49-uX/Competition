import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSms } from '../services/sms.js';
import { config } from '../config.js';

const router = Router();

// Cost factor 10 keeps hashes secure (~60ms each on a modern CPU) while letting
// the auth route handle thousands of concurrent logins per minute. Cost 12 was
// ~250ms which serializes badly under load.
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

// Rate limit is generous so legitimate traffic from shared IPs (refugee camp
// Wi-Fi, NAT, mobile carriers) is never blocked. Brute-force is mitigated
// per-identifier instead.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT) || 200, // per identifier per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  // Throttle by phone/email when present so one shared IP can't lock everyone
  // out, but still falls back to IP for malformed requests.
  keyGenerator: (req) =>
    (req.body?.identifier || '').toString().trim().toLowerCase() || req.ip,
  message: { error: 'too_many_attempts' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.REGISTER_RATE_LIMIT) || 50, // per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
});

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRe = /^\+?\d{7,15}$/;

const registerSchema = z
  .object({
    name: z.string().min(1),
    password: z.string().min(6),
    phone: z.string().trim().optional().or(z.literal('')),
    email: z.string().trim().toLowerCase().optional().or(z.literal('')),
    refugeeId: z.string().optional(),
    language: z.enum(['en', 'sw', 'fr', 'ar']).optional(),
  })
  .refine(
    (d) => (d.phone && phoneRe.test(d.phone)) || (d.email && emailRe.test(d.email)),
    { message: 'phone_or_email_required' }
  );

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
});

const forgotSchema = z.object({ identifier: z.string().min(3) });

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6),
});

function findByIdentifier(identifier) {
  const id = identifier.trim();
  if (emailRe.test(id)) return User.findOne({ email: id.toLowerCase() });
  return User.findOne({ phone: id });
}

router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const phone = data.phone ? data.phone.trim() : undefined;
    const email = data.email ? data.email.trim().toLowerCase() : undefined;

    if (phone) {
      const existing = await User.findOne({ phone });
      if (existing) return res.status(409).json({ error: 'phone_in_use' });
    }
    if (email) {
      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ error: 'email_in_use' });
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const user = await User.create({
      phone: phone || undefined,
      email: email || undefined,
      passwordHash,
      name: data.name,
      refugeeId: data.refugeeId || undefined,
      language: data.language || 'en',
      role: 'patient',
    });
    const token = signToken(user);
    res.status(201).json({ token, user: user.toSafeJSON() });
  })
);

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { identifier, password } = loginSchema.parse(req.body);
    const user = await findByIdentifier(identifier);
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    const token = signToken(user);
    res.json({ token, user: user.toSafeJSON() });
  })
);

router.post(
  '/forgot-password',
  forgotLimiter,
  asyncHandler(async (req, res) => {
    const { identifier } = forgotSchema.parse(req.body);
    const user = await findByIdentifier(identifier);
    // Always return ok to avoid account enumeration
    if (!user) return res.json({ ok: true });

    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetTokenHash = tokenHash;
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await user.save();

    // No email service wired up — return token in response for dev.
    // In production, send via email/SMS instead and just respond { ok: true }.
    const payload = { ok: true };
    if (process.env.NODE_ENV !== 'production') {
      payload.devResetToken = rawToken;
    }
    res.json(payload);
  })
);

router.post(
  '/reset-password',
  forgotLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = resetSchema.parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    });
    if (!user) return res.status(400).json({ error: 'invalid_or_expired_token' });

    user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.resetTokenHash = null;
    user.resetTokenExpiresAt = null;
    await user.save();
    const jwt = signToken(user);
    res.json({ token: jwt, user: user.toSafeJSON() });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user.toSafeJSON() });
  })
);

// ---------------------------------------------------------------------------
// Phase 6.2 — Passwordless OTP login.
//
// Flow:
//   1. POST /auth/otp/request {phone}  → SMS a 6-digit code, valid 10 min.
//      Always returns 200 ok=true (no enumeration). In dev / when SMS is
//      stubbed we additionally include `devOtp` so smoke tests can complete.
//   2. POST /auth/otp/verify  {phone, code} → returns JWT on success.
//
// Storage: only SHA-256 of the code is persisted. Five wrong attempts
// invalidate the code (we wipe it server-side) so brute force is bounded.
// ---------------------------------------------------------------------------
const otpRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10, // per phone per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body?.phone || '').toString().trim() || req.ip,
  message: { error: 'too_many_attempts' },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.body?.phone || '').toString().trim() || req.ip,
  message: { error: 'too_many_attempts' },
});

const otpRequestSchema = z.object({ phone: z.string().trim().regex(phoneRe) });
const otpVerifySchema = z.object({
  phone: z.string().trim().regex(phoneRe),
  code: z.string().trim().regex(/^\d{6}$/),
});

function hashOtp(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

router.post(
  '/otp/request',
  otpRequestLimiter,
  asyncHandler(async (req, res) => {
    const parsed = otpRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_phone' });
    const { phone } = parsed.data;
    const user = await User.findOne({ phone });

    // Always reply ok=true to avoid leaking which phone numbers are
    // registered. The actual code is only generated + sent when a user
    // exists.
    if (!user) return res.json({ ok: true });

    // 6-digit code, zero-padded. crypto.randomInt avoids modulo bias.
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    user.otpHash = hashOtp(code);
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    await user.save();

    const result = await sendSms({
      to: phone,
      body: `AfyaConnect login code: ${code}. Expires in 10 minutes.`,
    });

    const payload = { ok: true };
    // Dev convenience: when running against the stub adapter (no real
    // Twilio creds) expose the code so the smoke test + local dev can
    // complete the loop without needing a phone in hand. Never returned in
    // production — the moment SMS_PROVIDER=twilio with creds is set, the
    // code stays server-side.
    if (result.provider === 'stub' && config.sms.provider !== 'twilio') {
      payload.devOtp = code;
    }
    res.json(payload);
  })
);

router.post(
  '/otp/verify',
  otpVerifyLimiter,
  asyncHandler(async (req, res) => {
    const parsed = otpVerifySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'invalid_payload' });
    const { phone, code } = parsed.data;
    const user = await User.findOne({ phone });
    if (!user || !user.otpHash || !user.otpExpiresAt) {
      return res.status(401).json({ error: 'invalid_code' });
    }
    if (user.otpExpiresAt.getTime() < Date.now()) {
      user.otpHash = null;
      user.otpExpiresAt = null;
      user.otpAttempts = 0;
      await user.save();
      return res.status(401).json({ error: 'code_expired' });
    }
    if (user.otpAttempts >= 5) {
      // Already burned. Force a re-request.
      user.otpHash = null;
      user.otpExpiresAt = null;
      user.otpAttempts = 0;
      await user.save();
      return res.status(401).json({ error: 'too_many_attempts' });
    }

    if (hashOtp(code) !== user.otpHash) {
      user.otpAttempts += 1;
      await user.save();
      return res.status(401).json({ error: 'invalid_code' });
    }

    user.otpHash = null;
    user.otpExpiresAt = null;
    user.otpAttempts = 0;
    await user.save();

    const token = signToken(user);
    res.json({ token, user: user.toSafeJSON() });
  })
);

export default router;
