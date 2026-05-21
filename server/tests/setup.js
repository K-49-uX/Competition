// Vitest global setup. Boots an in-memory MongoDB so tests run hermetically
// — no external service, no shared DB. Each test suite is responsible for
// cleaning the collections it touches in a beforeEach hook.
import { afterAll, beforeAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Top-level env setup runs BEFORE test files import server modules, which is
// required for adapters whose `enabled` flag is computed at module load
// (e.g. the Daraja payment adapter inspects DARAJA_* envs at import time).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret';
process.env.FCM_ENABLED ||= 'false';
process.env.AUDIT_ENABLED ||= 'false';
// Phase 4.3 — keep Daraja enabled for the webhook parser test. Stripe
// stays off so the disabled-adapter path is also covered.
process.env.DARAJA_CONSUMER_KEY ||= 'test-key';
process.env.DARAJA_CONSUMER_SECRET ||= 'test-secret';
process.env.DARAJA_SHORTCODE ||= '174379';
process.env.DARAJA_PASSKEY ||= 'test-passkey';
process.env.DARAJA_CALLBACK_URL ||= 'https://example.test/callback';

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();

  await mongoose.connect(process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
