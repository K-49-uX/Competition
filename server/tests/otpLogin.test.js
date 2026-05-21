// Phase 6.2 — Passwordless OTP login integration tests.
// Verifies the request/verify flow against the real Express app + in-memory
// Mongo, including the dev-only `devOtp` helper used by the smoke script.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';

let app;

beforeAll(async () => {
  app = createApp();
  // Register a real patient via the public route to ensure the user is
  // shaped exactly like one created in production.
  await request(app)
    .post('/api/auth/register')
    .send({ name: 'OTP User', phone: '+254700900100', password: 'pw-12345' })
    .expect(201);
});

describe('OTP login', () => {
  it('rejects malformed phone', async () => {
    const res = await request(app)
      .post('/api/auth/otp/request')
      .send({ phone: 'not-a-phone' })
      .expect(400);
    expect(res.body.error).toBe('invalid_phone');
  });

  it('returns ok=true for unknown phones (no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/otp/request')
      .send({ phone: '+254700999000' })
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.devOtp).toBeUndefined();
  });

  it('issues a code and signs in with it', async () => {
    const reqRes = await request(app)
      .post('/api/auth/otp/request')
      .send({ phone: '+254700900100' })
      .expect(200);
    expect(reqRes.body.ok).toBe(true);
    expect(reqRes.body.devOtp).toMatch(/^\d{6}$/); // dev stub leaks the code

    const verRes = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: '+254700900100', code: reqRes.body.devOtp })
      .expect(200);
    expect(verRes.body.token).toBeTruthy();
    expect(verRes.body.user.phone).toBe('+254700900100');

    // After consumption the OTP should be cleared so the same code can't be replayed.
    const user = await User.findOne({ phone: '+254700900100' });
    expect(user.otpHash).toBeNull();
  });

  it('rejects a wrong code and increments attempts', async () => {
    await request(app)
      .post('/api/auth/otp/request')
      .send({ phone: '+254700900100' })
      .expect(200);
    const res = await request(app)
      .post('/api/auth/otp/verify')
      .send({ phone: '+254700900100', code: '000000' })
      .expect(401);
    expect(res.body.error).toBe('invalid_code');
    const user = await User.findOne({ phone: '+254700900100' });
    expect(user.otpAttempts).toBeGreaterThan(0);
  });
});
