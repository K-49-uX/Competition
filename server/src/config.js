import 'dotenv/config';

const required = ['MONGODB_URI', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[config] WARNING: ${key} is not set; using insecure default.`);
  }
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/afya',
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(s => s.trim()),
  fcm: {
    enabled: process.env.FCM_ENABLED === 'true',
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  },
  sms: {
    // 'stub' (default) logs to console; 'twilio' sends real SMS when creds present.
    provider: (process.env.SMS_PROVIDER || 'stub').toLowerCase(),
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM || '',
  },
  email: {
    // 'stub' logs to console (dev), 'noop' is silent (tests),
    // future: 'sendgrid' / 'ses' / 'postmark'.
    provider: (process.env.EMAIL_PROVIDER || 'stub').toLowerCase(),
    from: process.env.EMAIL_FROM || 'noreply@afyaconnect.org',
  },
  // Public base URL for building absolute links in outgoing email/SMS
  // (e.g. the email-verification link). Defaults to localhost dev.
  publicAppUrl: process.env.PUBLIC_APP_URL || 'http://localhost:5173',
  // Stripe (Phase 4.3). Optional; when keys are missing we fall back to
  // the existing stub donation provider.
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    successUrl: process.env.STRIPE_SUCCESS_URL || '',
    cancelUrl: process.env.STRIPE_CANCEL_URL || '',
  },
  // Safaricom Daraja (M-Pesa STK push). Optional like Stripe. Env names
  // match the adapter in services/payments.js (DARAJA_*).
  daraja: {
    consumerKey: process.env.DARAJA_CONSUMER_KEY || '',
    consumerSecret: process.env.DARAJA_CONSUMER_SECRET || '',
    shortcode: process.env.DARAJA_SHORTCODE || '',
    passkey: process.env.DARAJA_PASSKEY || '',
    callbackUrl: process.env.DARAJA_CALLBACK_URL || '',
  },
  admin: {
    phone: process.env.ADMIN_PHONE || '+254732501047',
    password: process.env.ADMIN_PASSWORD || 'admin1234',
    name: process.env.ADMIN_NAME || 'Camp Admin',
  },
  // Phase 0 feature flags. All default OFF so the existing site keeps behaving
  // exactly as before; toggle on once each piece is validated in staging.
  features: {
    audit: process.env.AUDIT_ENABLED !== 'false',
    metricsSnapshot: process.env.METRICS_SNAPSHOT_ENABLED !== 'false', // safe to run, just writes one doc/day
    docs: process.env.API_DOCS_ENABLED !== 'false', // Swagger UI on by default in dev/prod
    donations: process.env.DONATIONS_ENABLED !== 'false', // donate page is on by default; uses stub provider in dev
    donationsRequireRealProvider: process.env.DONATIONS_REQUIRE_REAL === 'true', // set in prod to forbid the stub adapter
    transparency: process.env.TRANSPARENCY_ENABLED !== 'false', // monthly public report (HTML now, PDF when pdfkit installs)
    testimonials: process.env.TESTIMONIALS_ENABLED !== 'false', // public stories with consent + admin moderation
    patientRecord: process.env.PATIENT_RECORD_ENABLED !== 'false', // lite EHR (vitals/allergies/conditions/meds/visit notes)
    teleconsult: process.env.TELECONSULT_ENABLED !== 'false', // Jitsi-backed video room per appointment
    prescriptions: process.env.PRESCRIPTIONS_ENABLED !== 'false', // clinician-issued prescriptions w/ printable HTML
    reminders: process.env.REMINDERS_ENABLED !== 'false', // appointment reminders cron (T-24h, T-1h)
  },
};
