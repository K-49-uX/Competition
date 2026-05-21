// Phase 3.5 — Clinic self-onboarding integration tests.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Clinic } from '../src/models/Clinic.js';
import { PendingClinicApplication } from '../src/models/PendingClinicApplication.js';

let app;
let adminToken;

beforeAll(async () => {
  app = createApp();
  // Seed a super-admin and log in to obtain a token.
  const passwordHash = await bcrypt.hash('admin1234', 10);
  await User.create({
    name: 'Super Admin',
    phone: '+254700000900',
    passwordHash,
    role: 'admin',
  });
  const res = await request(app)
    .post('/api/auth/login')
    .send({ identifier: '+254700000900', password: 'admin1234' })
    .expect(200);
  adminToken = res.body.token;
});

describe('Clinic onboarding', () => {
  const baseApp = {
    clinicName: 'Self Onboard Clinic',
    address: '1 Camp Rd',
    hours: '08:00 - 18:00',
    services: ['general'],
    lng: 35.6,
    lat: 3.7,
    adminName: 'Onboard Admin',
    adminEmail: 'admin@onboard-clinic.example',
    adminPhone: '+254700000901',
    password: 'onboardpw123',
  };

  it('rejects malformed application', async () => {
    await request(app)
      .post('/api/onboarding/clinic/request')
      .send({ clinicName: 'X' }) // missing required fields
      .expect(400);
  });

  it('full happy path: request → verify → approve creates Clinic + admin', async () => {
    const reqRes = await request(app)
      .post('/api/onboarding/clinic/request')
      .send(baseApp)
      .expect(201);
    expect(reqRes.body.ok).toBe(true);
    expect(reqRes.body.devVerifyToken).toBeTruthy();
    const id = reqRes.body.id;

    // Block approve before email is verified.
    await request(app)
      .post(`/api/onboarding/applications/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    await request(app)
      .get(`/api/onboarding/verify/${reqRes.body.devVerifyToken}`)
      .expect(200);

    const after = await PendingClinicApplication.findById(id);
    expect(after.status).toBe('email_verified');

    const approveRes = await request(app)
      .post(`/api/onboarding/applications/${id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(approveRes.body.ok).toBe(true);

    const clinic = await Clinic.findById(approveRes.body.clinicId);
    expect(clinic).toBeTruthy();
    expect(clinic.name).toBe('Self Onboard Clinic');

    const newAdmin = await User.findById(approveRes.body.adminUserId);
    expect(newAdmin.role).toBe('clinic_admin');
    expect(String(newAdmin.clinicId)).toBe(String(clinic._id));

    // The applicant's chosen password actually works on /auth/login.
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ identifier: baseApp.adminEmail, password: baseApp.password })
      .expect(200);
    expect(loginRes.body.user.role).toBe('clinic_admin');
  });

  it('rejects duplicate pending application', async () => {
    // First app is approved above; create + verify a second one then try
    // to submit a third for a brand-new email but reuse the same email
    // already in use — should 409 email_in_use.
    await request(app)
      .post('/api/onboarding/clinic/request')
      .send(baseApp)
      .expect(409);
  });

  it('rejection flow records reason', async () => {
    const reqRes = await request(app)
      .post('/api/onboarding/clinic/request')
      .send({ ...baseApp, adminEmail: 'reject@onboard-clinic.example' })
      .expect(201);
    const id = reqRes.body.id;
    await request(app)
      .post(`/api/onboarding/applications/${id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'incomplete documentation' })
      .expect(200);
    const after = await PendingClinicApplication.findById(id);
    expect(after.status).toBe('rejected');
    expect(after.rejectionReason).toBe('incomplete documentation');
  });

  it('non-admin cannot list applications', async () => {
    const r = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Pat', phone: '+254700001000', password: 'pw-12345' })
      .expect(201);
    await request(app)
      .get('/api/onboarding/applications')
      .set('Authorization', `Bearer ${r.body.token}`)
      .expect(403);
  });
});
