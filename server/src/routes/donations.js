import { Router, raw } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { Donation } from '../models/Donation.js';
import { Subscriber } from '../models/Subscriber.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getAdapter, defaultProvider, listAdapters } from '../services/payments.js';

const router = Router();

// Rate-limit checkout creation per IP. Real cards / M-Pesa already get
// per-account fraud checks at the provider, this is just a sanity gate.
const checkoutLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const checkoutSchema = z.object({
  amountUsd: z.number().positive().max(50_000),       // dollar amount entered by donor
  currency: z.enum(['USD', 'KES', 'EUR', 'GBP']).default('USD'),
  designation: z.enum(['general', 'sos', 'clinic', 'education']).default('general'),
  recurring: z.boolean().default(false),
  donorName: z.string().trim().max(120).optional(),
  donorEmail: z.string().trim().toLowerCase().email().optional(),
  donorPhone: z.string().trim().max(20).optional(),
  provider: z.enum(['stub', 'stripe', 'daraja', 'flutterwave']).optional(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

router.get(
  '/providers',
  asyncHandler(async (_req, res) => {
    res.json({ providers: listAdapters(), defaultProvider: defaultProvider() });
  })
);

router.post(
  '/checkout',
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    const data = checkoutSchema.parse(req.body);
    const provider = data.provider || defaultProvider();
    const adapter = getAdapter(provider);

    // amount stored in smallest currency unit (cents). USD/EUR/GBP use *100, KES is 1:1 (no cents).
    const amount = data.currency === 'KES'
      ? Math.round(data.amountUsd) * 100 // page passes a KES whole-amount in this case
      : Math.round(data.amountUsd * 100);

    const baseReturn = data.returnUrl || `${req.protocol}://${req.get('host')}/donate/thank-you`;
    const baseCancel = data.cancelUrl || `${req.protocol}://${req.get('host')}/donate?cancelled=1`;

    const session = await adapter.createCheckout({
      amount,
      currency: data.currency,
      designation: data.designation,
      recurring: data.recurring,
      donorName: data.donorName,
      donorEmail: data.donorEmail,
      donorPhone: data.donorPhone,
      returnUrl: baseReturn,
      cancelUrl: baseCancel,
    });

    const donation = await Donation.create({
      provider,
      providerSessionId: session.providerSessionId,
      amount,
      currency: data.currency,
      donorName: data.donorName || '',
      donorEmail: data.donorEmail || '',
      donorPhone: data.donorPhone || '',
      recurring: data.recurring,
      designation: data.designation,
      status: 'pending',
    });

    res.json({
      checkoutUrl: session.checkoutUrl,
      providerSessionId: session.providerSessionId,
      donationId: donation._id,
      provider,
      instructions: session.instructions || null,
    });
  })
);

// Stub-mode confirm endpoint. Only the stub adapter uses this; real providers
// flip status via /webhook/:provider.
router.post(
  '/confirm',
  asyncHandler(async (req, res) => {
    const { providerSessionId } = z.object({ providerSessionId: z.string().min(1) }).parse(req.body);
    const donation = await Donation.findOne({ providerSessionId, provider: 'stub' });
    if (!donation) return res.status(404).json({ error: 'session_not_found' });
    if (donation.status === 'pending') {
      donation.status = 'succeeded';
      donation.providerTxnId = `stub_txn_${Date.now()}`;
      donation.raw = { confirmedAt: new Date(), source: 'stub-confirm' };
      await donation.save();
    }
    res.json({ donation });
  })
);

// Provider webhooks. Stripe/Daraja sign their payloads, so we mount the raw
// body parser specifically for these routes (express.json() runs globally
// elsewhere — this raw handler short-circuits before JSON parsing).
router.post(
  '/webhook/:provider',
  raw({ type: '*/*' }),
  asyncHandler(async (req, res) => {
    const adapter = getAdapter(req.params.provider);
    let parsed;
    try {
      parsed = await adapter.parseWebhook({ rawBody: req.body, headers: req.headers });
    } catch (err) {
      console.warn(`[donations] webhook signature failed for ${adapter.id}:`, err?.message);
      return res.status(400).json({ error: 'invalid_signature' });
    }
    if (!parsed) return res.json({ received: true, applied: false });

    const update = {
      providerTxnId: parsed.providerTxnId,
      status: parsed.status,
      raw: { receivedAt: new Date(), metadata: parsed.metadata },
    };
    // If the provider tells us a more accurate amount/currency, trust it.
    if (parsed.amount) update.amount = parsed.amount;
    if (parsed.currency) update.currency = parsed.currency;
    const donation = await Donation.findOneAndUpdate(
      { providerSessionId: parsed.providerSessionId, provider: adapter.id },
      { $set: update },
      { new: true }
    );
    res.json({ received: true, applied: !!donation });
  })
);

router.get(
  '/recent',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const donations = await Donation.find({ status: 'succeeded' })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const totalsAgg = await Donation.aggregate([
      { $match: { status: 'succeeded' } },
      { $group: { _id: '$currency', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    res.json({
      donations,
      totals: totalsAgg.map((t) => ({ currency: t._id, total: t.total, count: t.count })),
    });
  })
);

// Newsletter signup. Double opt-in: returns the confirm token in dev so the
// flow can be exercised end-to-end without an email service. Once 6.1 lands
// (transactional email) we'll send the link via Postmark instead.
const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(120).optional(),
  language: z.enum(['en', 'sw', 'fr', 'ar']).optional(),
  source: z.string().trim().max(50).optional(),
});

router.post(
  '/subscribe',
  newsletterLimiter,
  asyncHandler(async (req, res) => {
    const data = subscribeSchema.parse(req.body);
    const existing = await Subscriber.findOne({ email: data.email });
    if (existing && existing.status === 'confirmed') {
      return res.json({ ok: true, alreadyConfirmed: true });
    }
    const rawToken = (await import('node:crypto')).randomBytes(24).toString('hex');
    const tokenHash = (await import('node:crypto')).createHash('sha256').update(rawToken).digest('hex');
    const sub = await Subscriber.findOneAndUpdate(
      { email: data.email },
      {
        $set: {
          name: data.name || existing?.name || '',
          language: data.language || existing?.language || 'en',
          source: data.source || existing?.source || 'donate-page',
          status: 'pending',
          confirmTokenHash: tokenHash,
        },
      },
      { new: true, upsert: true }
    );
    const payload = { ok: true, subscriberId: sub._id };
    if (process.env.NODE_ENV !== 'production') payload.devConfirmToken = rawToken;
    res.status(201).json(payload);
  })
);

router.get(
  '/subscribe/confirm',
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(10) }).parse(req.query);
    const tokenHash = (await import('node:crypto')).createHash('sha256').update(token).digest('hex');
    const sub = await Subscriber.findOne({ confirmTokenHash: tokenHash });
    if (!sub) return res.status(400).json({ error: 'invalid_or_expired_token' });
    sub.status = 'confirmed';
    sub.confirmedAt = new Date();
    sub.confirmTokenHash = null;
    await sub.save();
    res.json({ ok: true });
  })
);

export default router;
