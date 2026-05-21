// Phase 4.3 — Payment adapter unit tests.
//
// We set Daraja env vars BEFORE importing the payments module so the
// adapter is registered as enabled. This avoids the brittle dynamic-import
// cache-busting trick and matches how the real server is configured (envs
// are read once at startup).
process.env.DARAJA_CONSUMER_KEY = 'test-key';
process.env.DARAJA_CONSUMER_SECRET = 'test-secret';
process.env.DARAJA_SHORTCODE = '174379';
process.env.DARAJA_PASSKEY = 'test-passkey';
process.env.DARAJA_CALLBACK_URL = 'https://example.test/callback';

import { describe, it, expect } from 'vitest';
import { getAdapter, listAdapters } from '../src/services/payments.js';

describe('payments adapter registry', () => {
  it('lists stub, stripe, daraja, flutterwave', () => {
    const ids = listAdapters().map((a) => a.id).sort();
    expect(ids).toEqual(['daraja', 'flutterwave', 'stripe', 'stub']);
  });

  it('stub adapter is enabled by default', () => {
    const stub = listAdapters().find((a) => a.id === 'stub');
    expect(stub.enabled).toBe(true);
  });

  it('refuses to return a disabled adapter', () => {
    // STRIPE_SECRET_KEY is not set in the test env, so stripe is disabled.
    expect(() => getAdapter('stripe')).toThrow(/disabled|stripe/);
  });
});

describe('daraja webhook parser', () => {
  // STK callback shapes are exactly as documented at
  // https://developer.safaricom.co.ke/Documentation
  const successBody = JSON.stringify({
    Body: {
      stkCallback: {
        MerchantRequestID: 'a1b2-c3d4',
        CheckoutRequestID: 'ws_CO_TEST_1234567890',
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 250 },
            { Name: 'MpesaReceiptNumber', Value: 'NLJ7RT61SV' },
            { Name: 'TransactionDate', Value: 20231005120000 },
            { Name: 'PhoneNumber', Value: 254700000000 },
          ],
        },
      },
    },
  });

  const failureBody = JSON.stringify({
    Body: {
      stkCallback: {
        MerchantRequestID: 'a1b2-c3d4',
        CheckoutRequestID: 'ws_CO_TEST_FAIL',
        ResultCode: 1032,
        ResultDesc: 'Request cancelled by user',
      },
    },
  });

  it('parses a successful M-Pesa callback into the canonical shape', async () => {
    const adapter = getAdapter('daraja');
    const parsed = await adapter.parseWebhook({ rawBody: Buffer.from(successBody) });
    expect(parsed.providerSessionId).toBe('ws_CO_TEST_1234567890');
    expect(parsed.providerTxnId).toBe('NLJ7RT61SV');
    expect(parsed.status).toBe('succeeded');
    // 250 KES → 25000 minor units (matches /checkout amount math)
    expect(parsed.amount).toBe(25000);
    expect(parsed.currency).toBe('KES');
  });

  it('parses a user-cancelled callback as failed', async () => {
    const adapter = getAdapter('daraja');
    const parsed = await adapter.parseWebhook({ rawBody: Buffer.from(failureBody) });
    expect(parsed.providerSessionId).toBe('ws_CO_TEST_FAIL');
    expect(parsed.status).toBe('failed');
    expect(parsed.metadata.resultDesc).toMatch(/cancelled/i);
  });

  it('returns null for an unrelated payload (no stkCallback)', async () => {
    const adapter = getAdapter('daraja');
    const parsed = await adapter.parseWebhook({ rawBody: Buffer.from('{"Body":{}}') });
    expect(parsed).toBeNull();
  });
});
