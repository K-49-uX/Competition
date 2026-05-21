// Phase 3.5 — minimal email-sending facade. Mirrors the SMS adapter so we
// can swap in a real provider (SendGrid, SES, Postmark) later by just
// implementing `useReal()` below. For now: a stub that logs to stdout in dev
// and a `noop` mode for tests.
//
// Returns: { provider, ok, id?, error? }. Never throws.
import { config } from '../config.js';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendEmail({ to, subject, body }) {
  if (!to || !emailRe.test(String(to))) {
    return { provider: 'none', ok: false, error: 'invalid_email' };
  }
  if (!subject || !body) {
    return { provider: 'none', ok: false, error: 'missing_fields' };
  }
  if (config.email?.provider === 'noop' || process.env.EMAIL_PROVIDER === 'noop') {
    return { provider: 'noop', ok: true };
  }
  // Stub: log a single line so smoke + dev show what would have been sent.
  const oneLine = String(body).replace(/\s+/g, ' ').slice(0, 120);
  // eslint-disable-next-line no-console
  console.log(`[email:stub] -> ${to} | ${subject} | ${oneLine}`);
  return { provider: 'stub', ok: true };
}
