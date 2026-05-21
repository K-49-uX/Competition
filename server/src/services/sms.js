// Phase 5.2 — SMS adapter.
//
// Two backends:
//   * `twilio` — real send via the Twilio REST API (lazy-loaded, optional dep).
//   * `stub`   — logs to console; safe default for dev + tests.
//
// Selection: when `SMS_PROVIDER=twilio` AND TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
// + TWILIO_FROM are set, we send for real. Otherwise we stub.
//
// Public API:
//   await sendSms({ to, body })     -> { provider, ok, sid?, error? }
//   await sendBulkSms([{to, body}]) -> array of results
//
// Errors never throw — sending an SMS must not break the user flow that
// triggered it. Failures are logged and returned in the result object so
// callers can decide whether to retry / record.
import { config } from '../config.js';

let twilioClient = null;
let twilioInitFailed = false;

async function getTwilioClient() {
  if (twilioClient || twilioInitFailed) return twilioClient;
  try {
    const mod = await import('twilio');
    const Twilio = mod.default || mod;
    twilioClient = Twilio(config.sms.accountSid, config.sms.authToken);
    return twilioClient;
  } catch (err) {
    twilioInitFailed = true;
    console.warn('[sms] twilio package not installed, falling back to stub:', err.message);
    return null;
  }
}

function looksLikePhone(to) {
  return typeof to === 'string' && /^\+?\d{6,20}$/.test(to.replace(/\s|-/g, ''));
}

export async function sendSms({ to, body }) {
  if (!to || !body) return { provider: 'noop', ok: false, error: 'missing_to_or_body' };
  if (!looksLikePhone(to)) return { provider: 'noop', ok: false, error: 'invalid_phone' };

  const useTwilio =
    config.sms.provider === 'twilio' &&
    config.sms.accountSid &&
    config.sms.authToken &&
    config.sms.from;

  if (!useTwilio) {
    console.log(`[sms:stub] -> ${to}: ${body.slice(0, 80)}${body.length > 80 ? '…' : ''}`);
    return { provider: 'stub', ok: true };
  }

  const client = await getTwilioClient();
  if (!client) {
    console.log(`[sms:stub] (twilio init failed) -> ${to}: ${body.slice(0, 80)}`);
    return { provider: 'stub', ok: true };
  }
  try {
    const msg = await client.messages.create({ to, body, from: config.sms.from });
    return { provider: 'twilio', ok: true, sid: msg.sid };
  } catch (err) {
    console.error('[sms] twilio send failed:', err?.message);
    return { provider: 'twilio', ok: false, error: err?.message || 'send_failed' };
  }
}

export async function sendBulkSms(messages) {
  // Sequential — keeps it simple and avoids spamming Twilio with concurrent
  // requests. Volume is low (a few dozen reminders per cron tick at most).
  const out = [];
  for (const m of messages || []) out.push(await sendSms(m));
  return out;
}
