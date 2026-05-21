// Payment provider interface + adapters.
//
// Every adapter implements:
//   createCheckout({ amount, currency, donorEmail, donorName, donorPhone,
//                    designation, recurring, returnUrl, cancelUrl })
//     → { checkoutUrl, providerSessionId, instructions? }
//
//   parseWebhook({ rawBody, headers })
//     → { providerSessionId, providerTxnId, status, amount, currency, metadata }
//
// `stub` is the dev/no-keys default — it skips the real provider and returns
// a checkout URL on our own site that auto-confirms the donation. This lets
// the entire UX flow be exercised end-to-end without any external accounts.

import crypto from 'node:crypto';
import { config } from '../config.js';

// -----------------------------------------------------------------------------
// stub adapter (dev / no keys)
// -----------------------------------------------------------------------------
const stubAdapter = {
  id: 'stub',
  enabled: true,
  async createCheckout(opts) {
    const sessionId = `stub_${crypto.randomBytes(8).toString('hex')}`;
    // Land on the thank-you page directly. The page calls /api/donations/confirm
    // with this id to flip the donation row to `succeeded`.
    const url = new URL(opts.returnUrl);
    url.searchParams.set('session', sessionId);
    url.searchParams.set('provider', 'stub');
    return {
      checkoutUrl: url.toString(),
      providerSessionId: sessionId,
      instructions: 'Demo mode — no real charge. Click "Continue" to simulate a successful payment.',
    };
  },
  parseWebhook() {
    throw new Error('stub adapter has no webhook; use POST /api/donations/confirm');
  },
};

// -----------------------------------------------------------------------------
// stripe adapter (real implementation kicks in when STRIPE_SECRET_KEY is set)
// -----------------------------------------------------------------------------
const stripeAdapter = {
  id: 'stripe',
  enabled: !!process.env.STRIPE_SECRET_KEY,
  async createCheckout(opts) {
    // Lazy require so Stripe SDK isn't a hard dependency for installs that
    // never enable it. Only loaded when keys are present.
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    const session = await stripe.checkout.sessions.create({
      mode: opts.recurring ? 'subscription' : 'payment',
      line_items: [
        {
          price_data: {
            currency: opts.currency.toLowerCase(),
            product_data: { name: `AfyaConnect donation (${opts.designation})` },
            unit_amount: opts.amount,
            ...(opts.recurring ? { recurring: { interval: 'month' } } : {}),
          },
          quantity: 1,
        },
      ],
      success_url: `${opts.returnUrl}?session={CHECKOUT_SESSION_ID}&provider=stripe`,
      cancel_url: opts.cancelUrl,
      customer_email: opts.donorEmail || undefined,
      metadata: { designation: opts.designation, donorName: opts.donorName || '' },
    });
    return { checkoutUrl: session.url, providerSessionId: session.id };
  },
  async parseWebhook({ rawBody, headers }) {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    const sig = headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    const obj = event.data.object;
    if (event.type === 'checkout.session.completed' || event.type === 'invoice.paid') {
      return {
        providerSessionId: obj.id || obj.checkout_session,
        providerTxnId: obj.payment_intent || obj.id,
        status: 'succeeded',
        amount: obj.amount_total || obj.amount_paid,
        currency: (obj.currency || 'usd').toUpperCase(),
        metadata: obj.metadata || {},
      };
    }
    if (event.type === 'checkout.session.expired' || event.type === 'invoice.payment_failed') {
      return { providerSessionId: obj.id, status: 'failed', amount: obj.amount_total || 0, currency: 'USD', metadata: {} };
    }
    return null;
  },
};

// -----------------------------------------------------------------------------
// daraja adapter (M-Pesa). Real call wired only when DARAJA_* envs are set.
// -----------------------------------------------------------------------------
const darajaAdapter = {
  id: 'daraja',
  enabled: !!(process.env.DARAJA_CONSUMER_KEY && process.env.DARAJA_CONSUMER_SECRET && process.env.DARAJA_SHORTCODE),
  async createCheckout(opts) {
    if (!opts.donorPhone) throw Object.assign(new Error('phone_required'), { status: 400 });
    const auth = Buffer.from(`${process.env.DARAJA_CONSUMER_KEY}:${process.env.DARAJA_CONSUMER_SECRET}`).toString('base64');
    // Token
    const tokenResp = await fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
      headers: { Authorization: `Basic ${auth}` },
    });
    const { access_token } = await tokenResp.json();
    if (!access_token) throw new Error('daraja_auth_failed');
    // STK push
    const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const password = Buffer.from(`${process.env.DARAJA_SHORTCODE}${process.env.DARAJA_PASSKEY}${ts}`).toString('base64');
    const stkResp = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: process.env.DARAJA_SHORTCODE,
        Password: password,
        Timestamp: ts,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.max(1, Math.round(opts.amount / 100)), // KES is whole units
        PartyA: opts.donorPhone.replace(/^\+/, ''),
        PartyB: process.env.DARAJA_SHORTCODE,
        PhoneNumber: opts.donorPhone.replace(/^\+/, ''),
        CallBackURL: process.env.DARAJA_CALLBACK_URL,
        AccountReference: 'AfyaConnect',
        TransactionDesc: `Donation (${opts.designation})`,
      }),
    });
    const stk = await stkResp.json();
    if (!stk.CheckoutRequestID) throw Object.assign(new Error(stk.errorMessage || 'daraja_stk_failed'), { status: 502 });
    return {
      checkoutUrl: opts.returnUrl, // No redirect — patient confirms on their phone
      providerSessionId: stk.CheckoutRequestID,
      instructions: 'Check your phone for an M-Pesa prompt and enter your PIN to complete the donation.',
    };
  },
  async parseWebhook({ rawBody }) {
    const body = JSON.parse(rawBody.toString('utf8'));
    const cb = body?.Body?.stkCallback;
    if (!cb) return null;
    const success = cb.ResultCode === 0;
    const items = cb.CallbackMetadata?.Item || [];
    const amount = items.find((i) => i.Name === 'Amount')?.Value || 0;
    const txnId = items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value || null;
    return {
      providerSessionId: cb.CheckoutRequestID,
      providerTxnId: txnId,
      status: success ? 'succeeded' : 'failed',
      amount: Math.round(amount * 100),
      currency: 'KES',
      metadata: { resultDesc: cb.ResultDesc },
    };
  },
};

// -----------------------------------------------------------------------------
// flutterwave adapter — placeholder that will be enabled later
// -----------------------------------------------------------------------------
const flutterwaveAdapter = {
  id: 'flutterwave',
  enabled: !!process.env.FLUTTERWAVE_SECRET_KEY,
  async createCheckout() { throw Object.assign(new Error('flutterwave_not_implemented'), { status: 501 }); },
  async parseWebhook() { return null; },
};

// -----------------------------------------------------------------------------
// registry
// -----------------------------------------------------------------------------
const adapters = {
  stub: stubAdapter,
  stripe: stripeAdapter,
  daraja: darajaAdapter,
  flutterwave: flutterwaveAdapter,
};

export function getAdapter(provider) {
  const a = adapters[provider];
  if (!a) throw Object.assign(new Error('unknown_provider'), { status: 400 });
  if (!a.enabled) throw Object.assign(new Error(`${provider}_disabled`), { status: 503 });
  return a;
}

export function listAdapters() {
  return Object.values(adapters).map((a) => ({ id: a.id, enabled: a.enabled }));
}

// Default provider when the client doesn't specify one. Prefers real providers
// over the stub so production never accidentally serves a fake checkout.
export function defaultProvider() {
  if (config.features.donationsRequireRealProvider) {
    if (stripeAdapter.enabled) return 'stripe';
    if (darajaAdapter.enabled) return 'daraja';
    if (flutterwaveAdapter.enabled) return 'flutterwave';
    throw Object.assign(new Error('no_payment_provider_configured'), { status: 503 });
  }
  if (stripeAdapter.enabled) return 'stripe';
  if (darajaAdapter.enabled) return 'daraja';
  return 'stub';
}
