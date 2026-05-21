// Integration test for the prescription create + fetch flow. Boots the
// real Express app against the in-memory Mongo from setup.js and walks
// through a clinician issuing a prescription for a patient appointment,
// then both the patient and an unrelated user trying to read it.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { Clinic } from '../src/models/Clinic.js';
import { Appointment } from '../src/models/Appointment.js';

let app;
let clinic;
let patientToken;
let otherToken;
let clinicianToken;
let appointmentId;

async function register(payload) {
  const res = await request(app).post('/api/auth/register').send(payload).expect(201);
  return res.body;
}

beforeAll(async () => {
  app = createApp();

  clinic = await Clinic.create({
    name: 'Test Clinic',
    city: 'Kakuma',
    country: 'Kenya',
    location: { type: 'Point', coordinates: [0, 0] },
  });

  // Patient + an unrelated patient
  const p = await register({ name: 'Pat One', phone: '+254700000111', password: 'pass1234' });
  patientToken = p.token;
  const o = await register({ name: 'Other', phone: '+254700000222', password: 'pass1234' });
  otherToken = o.token;

  // Clinician — register normally then promote, since /auth/register only
  // mints patients.
  const c = await register({ name: 'Doc', phone: '+254700000333', password: 'pass1234' });
  await User.updateOne(
    { _id: c.user.id },
    { $set: { role: 'clinician', clinicId: clinic._id } }
  );
  clinicianToken = c.token;

  // Seed an appointment owned by the patient at this clinic.
  const appt = await Appointment.create({
    patientId: new mongoose.Types.ObjectId(p.user.id),
    clinicId: clinic._id,
    type: 'general',
    status: 'serving',
    ticketNumber: 1,
    scheduledFor: new Date(),
  });
  appointmentId = appt._id.toString();
});

describe('POST /api/prescriptions', () => {
  let createdId;

  it('lets a clinician create a prescription for a real appointment', async () => {
    const res = await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .send({
        appointmentId,
        diagnosis: 'Test diagnosis',
        items: [{ drug: 'Amoxicillin', dose: '500mg', frequency: 'TID', durationDays: 7 }],
      })
      .expect(201);
    expect(res.body.prescription).toBeTruthy();
    expect(res.body.prescription.prescriptionNumber).toBeGreaterThan(0);
    expect(res.body.prescription.items).toHaveLength(1);
    createdId = res.body.prescription._id;
  });

  it('rejects an empty items array', async () => {
    await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${clinicianToken}`)
      .send({ appointmentId, items: [] })
      .expect(400);
  });

  it('forbids non-clinician roles', async () => {
    await request(app)
      .post('/api/prescriptions')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ appointmentId, items: [{ drug: 'X' }] })
      .expect(403);
  });

  it('lets the owning patient list their prescriptions', async () => {
    const res = await request(app)
      .get('/api/prescriptions/me')
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);
    expect(res.body.prescriptions.some((p) => p._id === createdId)).toBe(true);
  });

  it('blocks an unrelated patient from reading the prescription', async () => {
    await request(app)
      .get(`/api/prescriptions/${createdId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('renders printable HTML containing the medication name', async () => {
    const res = await request(app)
      .get(`/api/prescriptions/${createdId}/html`)
      .set('Authorization', `Bearer ${clinicianToken}`)
      .expect(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('Amoxicillin');
  });
});
