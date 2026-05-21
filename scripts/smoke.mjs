// End-to-end smoke test for AfyaConnect.
// Requires server running on localhost:4000 (or override with API_URL).
//
// Verifies the seven critical existing flows that PRs MUST NOT break, plus
// the new Phase 0 endpoints (Swagger UI + public metrics). Exits non-zero on
// any failure so it can gate CI.
//
// Usage: node scripts/smoke.mjs

const BASE = process.env.API_URL || 'http://localhost:4000/api';

const PASS = '\u001b[32m\u2713\u001b[0m';
const FAIL = '\u001b[31m\u2717\u001b[0m';

let passed = 0;
let failed = 0;
const failures = [];

async function check(label, fn) {
  process.stdout.write(`  ${label} \u2026 `);
  try {
    const result = await fn();
    passed++;
    console.log(PASS, result || '');
  } catch (err) {
    failed++;
    failures.push({ label, err });
    console.log(FAIL, err?.message || String(err));
  }
}

async function call(method, path, { token, body, expectStatus } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (expectStatus != null) {
    if (res.status !== expectStatus) {
      throw new Error(`${method} ${path} -> expected ${expectStatus}, got ${res.status} ${JSON.stringify(json)}`);
    }
    return { status: res.status, json };
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

const ts = Date.now();
const phone = `+25470000${String(ts).slice(-4)}`;
const adminPhone = process.env.ADMIN_PHONE || '+254732501047';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';

console.log('--- AfyaConnect smoke ---');
console.log('Base:', BASE);

console.log('\n[critical existing flows]');
await check('GET /health returns ok=true', async () => {
  const h = await call('GET', '/health');
  if (!h.ok) throw new Error('ok flag false');
  return `ts=${h.ts}`;
});

let patientToken;
await check('POST /auth/register issues a token', async () => {
  const reg = await call('POST', '/auth/register', {
    body: { phone, password: 'test1234', name: 'Smoke Test', language: 'en' },
  });
  if (!reg.token) throw new Error('no token in response');
  patientToken = reg.token;
  return `user=${reg.user.id}`;
});

await check('POST /auth/login (seeded admin) succeeds first try', async () => {
  const r = await call('POST', '/auth/login', {
    body: { identifier: adminPhone, password: adminPassword },
  });
  if (!r.token) throw new Error('no token');
  return `role=${r.user.role}`;
});

let clinicId;
await check('GET /clinics returns >= 20 partner clinics', async () => {
  const { clinics } = await call('GET', '/clinics');
  if (!Array.isArray(clinics) || clinics.length < 20) {
    throw new Error(`expected >=20 clinics, got ${clinics?.length}`);
  }
  clinicId = clinics[0]._id;
  return `count=${clinics.length}`;
});

await check('GET /appointments/slots returns slot list for today', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const { slots } = await call('GET', `/appointments/slots?clinicId=${clinicId}&date=${today}`);
  if (!Array.isArray(slots)) throw new Error('slots is not an array');
  return `slots=${slots.length}`;
});

let guestAppointmentId;
await check('POST /appointments/guest issues ticket', async () => {
  const guestPhone = `+25471111${String(ts).slice(-4)}`;
  const r = await call('POST', '/appointments/guest', {
    body: {
      clinicId,
      patientName: 'Guest Smoke',
      patientPhone: guestPhone,
      patientAge: 30,
      patientSex: 'female',
      selfReportedSymptoms: ['chest_pain'],
      consent: true,
    },
  });
  if (!r.appointment?.ticketNumber) throw new Error('no ticketNumber');
  guestAppointmentId = r.appointment._id;
  return `ticket=${r.appointment.ticketNumber}`;
});

await check('GET /education?lang=en returns >= 50 topics', async () => {
  const r = await call('GET', '/education?lang=en');
  const items = r.items || r.content;
  if (!Array.isArray(items)) throw new Error('items is not an array');
  if (items.length < 50) throw new Error(`expected >=50 topics, got ${items.length}`);
  return `topics=${items.length}`;
});

await check('POST /sos with clinicId+address creates notification', async () => {
  const r = await call('POST', '/sos', {
    token: patientToken,
    body: {
      clinicId,
      message: 'smoke test SOS',
      address: 'Smoke test address, near landmark',
      lng: 34.8689,
      lat: 3.7172,
    },
  });
  if (!r.notification?._id) throw new Error('no notification id');
  return `id=${r.notification._id}`;
});

console.log('\n[phase 0 additions]');
await check('GET /api/metrics/public returns counts', async () => {
  const m = await call('GET', '/metrics/public');
  if (!m.counts) throw new Error('no counts');
  return `clinics=${m.counts.clinics} patients=${m.counts.patientsTotal}`;
});

await check('GET /api/docs.json returns OpenAPI spec', async () => {
  const spec = await call('GET', '/docs.json');
  if (spec.openapi !== '3.0.3') throw new Error(`unexpected openapi: ${spec.openapi}`);
  return `tags=${spec.tags?.length || 0}`;
});

console.log('\n[phase 1.2 donations]');
let donationSession;
await check('GET /api/donations/providers lists adapters', async () => {
  const r = await call('GET', '/donations/providers');
  if (!Array.isArray(r.providers)) throw new Error('no providers list');
  if (!r.defaultProvider) throw new Error('no defaultProvider');
  return `default=${r.defaultProvider} count=${r.providers.length}`;
});

await check('POST /api/donations/checkout creates pending donation (stub)', async () => {
  const r = await call('POST', '/donations/checkout', {
    body: { amountUsd: 25, designation: 'general', provider: 'stub' },
  });
  if (!r.checkoutUrl || !r.providerSessionId) throw new Error('missing checkout fields');
  donationSession = r.providerSessionId;
  return `session=${donationSession.slice(0, 12)}…`;
});

await check('POST /api/donations/confirm flips stub donation to succeeded', async () => {
  const r = await call('POST', '/donations/confirm', {
    body: { providerSessionId: donationSession },
  });
  if (r.donation?.status !== 'succeeded') throw new Error(`status=${r.donation?.status}`);
  return `amount=${r.donation.amount}`;
});

await check('POST /api/donations/subscribe creates pending subscriber', async () => {
  const email = `smoke-${ts}@example.org`;
  const r = await call('POST', '/donations/subscribe', {
    body: { email, source: 'smoke', language: 'en' },
  });
  if (!r.subscriberId) throw new Error('no subscriberId');
  if (!r.devConfirmToken) throw new Error('no devConfirmToken (dev mode expected)');
  return `id=${r.subscriberId}`;
});

console.log('\n[phase 1.3 transparency]');
await check('GET /api/transparency returns reports list', async () => {
  const r = await call('GET', '/transparency');
  if (!Array.isArray(r.reports)) throw new Error('reports not an array');
  return `count=${r.reports.length}`;
});

await check('GET /api/transparency/:y/:m returns aggregated data', async () => {
  const now = new Date();
  const r = await call('GET', `/transparency/${now.getUTCFullYear()}/${now.getUTCMonth() + 1}`);
  if (!r.summary) throw new Error('no summary');
  return `period=${r.period} days=${r.daysCovered}`;
});

await check('GET /api/transparency/:y/:m/html returns printable HTML', async () => {
  const now = new Date();
  const url = `${BASE}/transparency/${now.getUTCFullYear()}/${now.getUTCMonth() + 1}/html`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.startsWith('text/html')) throw new Error(`content-type=${ct}`);
  const body = await res.text();
  if (!body.includes('AfyaConnect Transparency Report')) throw new Error('missing header');
  return `bytes=${body.length}`;
});

console.log('\n[phase 1.4 testimonials]');
let testimonialId;
await check('POST /api/testimonials accepts story with consent', async () => {
  const r = await call('POST', '/testimonials', {
    body: {
      name: `Smoke Tester ${ts}`,
      role: 'patient',
      location: 'Kakuma 1',
      language: 'en',
      quote: 'AfyaConnect helped me find a clinic in my own language. The smoke test version of this story is at least 30 characters long.',
      consent: true,
      consentText: 'I confirm that the story above is mine to share, and I give AfyaConnect permission to publish it.',
    },
  });
  if (!r.id) throw new Error('no id');
  testimonialId = r.id;
  return `id=${testimonialId}`;
});

await check('POST /api/testimonials rejects missing consent (validation)', async () => {
  const { status } = await call('POST', '/testimonials', {
    body: {
      name: 'No Consent',
      role: 'patient',
      language: 'en',
      quote: 'This story has no consent and should be rejected by the validator.',
      consentText: 'irrelevant since consent flag is missing',
    },
    expectStatus: 400,
  });
  return `status=${status}`;
});

let adminToken;
await check('Admin login + GET /testimonials/admin lists pending', async () => {
  const login = await call('POST', '/auth/login', {
    body: { identifier: adminPhone, password: adminPassword },
  });
  adminToken = login.token;
  const r = await call('GET', '/testimonials/admin?status=pending', { token: adminToken });
  if (!Array.isArray(r.testimonials)) throw new Error('no testimonials array');
  return `pending=${r.testimonials.length}`;
});

await check('PATCH /api/testimonials/admin/:id approves', async () => {
  const r = await call('PATCH', `/testimonials/admin/${testimonialId}`, {
    token: adminToken,
    body: { status: 'approved', featured: true },
  });
  if (r.testimonial?.status !== 'approved') throw new Error(`status=${r.testimonial?.status}`);
  return 'approved+featured';
});

await check('GET /api/testimonials lists newly approved story', async () => {
  const r = await call('GET', '/testimonials?limit=20');
  const found = (r.testimonials || []).some((t) => t._id === testimonialId);
  if (!found) throw new Error('approved story not in public list');
  return `count=${r.testimonials.length}`;
});

console.log('\n[phase 2.1 patient record]');
await check('GET /api/patients/me/record returns shell for new patient', async () => {
  const r = await call('GET', '/patients/me/record', { token: patientToken });
  if (!r.record) throw new Error('no record');
  if (!Array.isArray(r.visits)) throw new Error('no visits array');
  return `bloodType=${r.record.bloodType}`;
});

let patientUserId;
await check('POST /api/patients/:id/record/allergies (clinician) adds entry', async () => {
  // Use the admin token (admin role passes the clinician/admin gate)
  // Resolve the patient's user id from its token
  const me = await call('GET', '/patients/me/record', { token: patientToken });
  patientUserId = me.record.patientId;
  const r = await call('POST', `/patients/${patientUserId}/record/allergies`, {
    token: adminToken,
    body: { substance: 'Penicillin', reaction: 'rash', severity: 'moderate' },
  });
  if (!r.record?.allergies?.length) throw new Error('allergy not stored');
  return `allergies=${r.record.allergies.length}`;
});

await check('PATCH /api/patients/:id/record updates blood type + summary', async () => {
  const r = await call('PATCH', `/patients/${patientUserId}/record`, {
    token: adminToken,
    body: { bloodType: 'O+', summary: 'Smoke test summary.' },
  });
  if (r.record?.bloodType !== 'O+') throw new Error(`bloodType=${r.record?.bloodType}`);
  return 'updated';
});

await check('Patient sees their own allergy after clinician add', async () => {
  const r = await call('GET', '/patients/me/record', { token: patientToken });
  if (!r.record.allergies?.some((a) => a.substance === 'Penicillin')) throw new Error('allergy not visible to patient');
  if (r.record.bloodType !== 'O+') throw new Error('bloodType not visible');
  return 'ok';
});

await check('GET /api/patients/:id/record (clinician) returns patient + record + visits', async () => {
  const r = await call('GET', `/patients/${patientUserId}/record`, { token: adminToken });
  if (!r.patient?.name) throw new Error('no patient');
  if (!r.record) throw new Error('no record');
  if (!Array.isArray(r.visits)) throw new Error('no visits');
  return `name=${r.patient.name}`;
});

await check('GET /api/patients/:id/record requires clinician/admin role', async () => {
  const { status } = await call('GET', `/patients/${patientUserId}/record`, {
    token: patientToken, // patient role -> 403
    expectStatus: 403,
  });
  return `status=${status}`;
});

console.log('\n[phase 2.2 triage]');
await check('Guest booking with red-flag symptoms auto-suggests severity', async () => {
  // Verify the guest booking we made earlier picked up the chest_pain flag.
  const r = await call('GET', '/appointments/admin', { token: adminToken });
  const found = r.appointments.find((a) => a._id === guestAppointmentId);
  if (!found) throw new Error('guest appointment not in admin list');
  if (found.triage?.severity !== 'high') throw new Error(`expected high, got ${found.triage?.severity}`);
  if (!found.triage?.selfReportedSymptoms?.includes('chest_pain')) throw new Error('symptom not stored');
  return `severity=${found.triage.severity}`;
});

await check('GET /appointments/triage/symptoms returns catalogue', async () => {
  const r = await call('GET', '/appointments/triage/symptoms');
  if (!Array.isArray(r.symptoms) || r.symptoms.length < 5) throw new Error('symptom catalogue too short');
  return `count=${r.symptoms.length}`;
});

await check('POST /appointments/:id/triage (clinician) updates severity', async () => {
  const r = await call('POST', `/appointments/${guestAppointmentId}/triage`, {
    token: adminToken,
    body: { severity: 'critical', notes: 'Smoke triage note.' },
  });
  if (r.appointment?.triage?.severity !== 'critical') throw new Error(`severity=${r.appointment?.triage?.severity}`);
  if (!r.appointment?.triage?.assessedBy) throw new Error('assessedBy not stored');
  return 'critical';
});

await check('POST /appointments/:id/triage requires clinician role', async () => {
  const { status } = await call('POST', `/appointments/${guestAppointmentId}/triage`, {
    token: patientToken,
    body: { severity: 'low' },
    expectStatus: 403,
  });
  return `status=${status}`;
});

await check('GET /appointments/admin sorts critical to top', async () => {
  const r = await call('GET', '/appointments/admin', { token: adminToken });
  if (r.appointments[0]?._id !== guestAppointmentId) throw new Error(`top id=${r.appointments[0]?._id}`);
  return 'top=critical';
});

await check('GET /queue/:clinicId reports urgentWaiting count', async () => {
  const r = await call('GET', `/queue/${clinicId}`);
  if (typeof r.urgentWaiting !== 'number') throw new Error('urgentWaiting not numeric');
  if (r.urgentWaiting < 1) throw new Error(`expected >=1 urgent, got ${r.urgentWaiting}`);
  return `urgent=${r.urgentWaiting}`;
});

await check('Booking rejects unknown symptom keys', async () => {
  const guestPhone = `+25472222${String(ts).slice(-4)}`;
  const { status } = await call('POST', '/appointments/guest', {
    expectStatus: 400,
    body: {
      clinicId,
      patientName: 'Smoke Bad Symptom',
      patientPhone: guestPhone,
      selfReportedSymptoms: ['not_a_real_symptom'],
      consent: true,
    },
  });
  return `status=${status}`;
});

console.log('\n[phase 2.3 teleconsult]');
let patientApptId;
await check('Patient books appointment (needed for teleconsult)', async () => {
  const r = await call('POST', '/appointments', {
    token: patientToken,
    body: { clinicId, reason: 'teleconsult smoke' },
  });
  if (!r.appointment?._id) throw new Error('no appointment');
  patientApptId = r.appointment._id;
  return `id=${patientApptId}`;
});

await check('GET teleconsult before start returns 404 not_started', async () => {
  const { status } = await call('GET', `/appointments/${patientApptId}/teleconsult`, {
    token: patientToken,
    expectStatus: 404,
  });
  return `status=${status}`;
});

let teleJoinUrl;
await check('POST teleconsult (clinician) creates Jitsi room', async () => {
  const r = await call('POST', `/appointments/${patientApptId}/teleconsult`, { token: adminToken });
  if (!r.teleconsult?.joinUrl) throw new Error('no joinUrl');
  if (!r.teleconsult.joinUrl.includes('afya-')) throw new Error(`unexpected room name: ${r.teleconsult.joinUrl}`);
  teleJoinUrl = r.teleconsult.joinUrl;
  return `room=${r.teleconsult.roomName}`;
});

await check('Patient can fetch their teleconsult join info', async () => {
  const r = await call('GET', `/appointments/${patientApptId}/teleconsult`, { token: patientToken });
  if (r.teleconsult?.joinUrl !== teleJoinUrl) throw new Error('joinUrl mismatch');
  return 'ok';
});

await check('Other patient gets 403 on someone else\'s teleconsult', async () => {
  // Register a fresh patient and try to read the first one's teleconsult
  const otherPhone = `+25473333${String(ts).slice(-4)}`;
  const reg = await call('POST', '/auth/register', {
    body: { phone: otherPhone, password: 'test1234', name: 'Other Smoke', language: 'en' },
  });
  const { status } = await call('GET', `/appointments/${patientApptId}/teleconsult`, {
    token: reg.token,
    expectStatus: 403,
  });
  return `status=${status}`;
});

await check('POST teleconsult requires clinician role', async () => {
  const { status } = await call('POST', `/appointments/${patientApptId}/teleconsult`, {
    token: patientToken,
    expectStatus: 403,
  });
  return `status=${status}`;
});

await check('POST teleconsult fails for guest appointment', async () => {
  const { status } = await call('POST', `/appointments/${guestAppointmentId}/teleconsult`, {
    token: adminToken,
    expectStatus: 400,
  });
  return `status=${status}`;
});

await check('POST teleconsult/end (clinician) marks the room ended', async () => {
  const r = await call('POST', `/appointments/${patientApptId}/teleconsult/end`, { token: adminToken });
  if (!r.endedAt) throw new Error('no endedAt');
  return 'ended';
});

console.log('\n[phase 2.4 prescriptions]');
let prescriptionId;
await check('POST /prescriptions (clinician) creates with sequence number', async () => {
  const r = await call('POST', '/prescriptions', {
    token: adminToken,
    body: {
      appointmentId: patientApptId,
      diagnosis: 'Smoke test diagnosis',
      items: [
        { drug: 'Amoxicillin', dose: '500mg', frequency: 'TID', durationDays: 7, instructions: 'after meals' },
        { drug: 'Paracetamol', dose: '500mg', frequency: 'PRN', durationDays: 3 },
      ],
      notes: 'Follow up in 1 week.',
    },
  });
  if (!r.prescription?._id) throw new Error('no prescription');
  if (!r.prescription.prescriptionNumber) throw new Error('no number');
  if (r.prescription.items.length !== 2) throw new Error('items lost');
  prescriptionId = r.prescription._id;
  return `№${r.prescription.year}-${String(r.prescription.prescriptionNumber).padStart(4, '0')}`;
});

await check('POST /prescriptions rejects empty items', async () => {
  const { status } = await call('POST', '/prescriptions', {
    token: adminToken,
    expectStatus: 400,
    body: { appointmentId: patientApptId, items: [] },
  });
  return `status=${status}`;
});

await check('POST /prescriptions requires clinician role', async () => {
  const { status } = await call('POST', '/prescriptions', {
    token: patientToken,
    expectStatus: 403,
    body: { appointmentId: patientApptId, items: [{ drug: 'X' }] },
  });
  return `status=${status}`;
});

await check('GET /prescriptions/me (patient) lists own prescription', async () => {
  const r = await call('GET', '/prescriptions/me', { token: patientToken });
  const found = (r.prescriptions || []).some((p) => p._id === prescriptionId);
  if (!found) throw new Error('not in patient list');
  return `count=${r.prescriptions.length}`;
});

await check('GET /prescriptions/:id/html returns printable HTML', async () => {
  const res = await fetch(`${BASE}/prescriptions/${prescriptionId}/html`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) throw new Error(`status=${res.status}`);
  const html = await res.text();
  if (!html.includes('Amoxicillin')) throw new Error('drug not in html');
  if (!html.includes('Prescription')) throw new Error('header missing');
  return `bytes=${html.length}`;
});

await check('GET /prescriptions/:id (other patient) returns 403', async () => {
  // Reuse the "other" patient registered earlier in the teleconsult section.
  // Instead of plumbing tokens around we just register another fresh one.
  const phone3 = `+25474444${String(ts).slice(-4)}`;
  const reg = await call('POST', '/auth/register', {
    body: { phone: phone3, password: 'test1234', name: 'Third Smoke', language: 'en' },
  });
  const { status } = await call('GET', `/prescriptions/${prescriptionId}`, {
    token: reg.token,
    expectStatus: 403,
  });
  return `status=${status}`;
});

console.log('\n[phase 3.1 multi-clinic / rbac]');
await check('GET /admin/overview (admin) returns aggregate scope', async () => {
  const r = await call('GET', '/admin/overview', { token: adminToken });
  if (r.scope !== 'all') throw new Error(`scope=${r.scope}`);
  if (typeof r.today?.booked !== 'number') throw new Error('no today.booked');
  if (typeof r.triage?.urgentWaiting !== 'number') throw new Error('no triage.urgentWaiting');
  return `booked=${r.today.booked} urgent=${r.triage.urgentWaiting}`;
});

await check('GET /admin/overview?clinicId= scopes to a single clinic', async () => {
  const r = await call('GET', `/admin/overview?clinicId=${clinicId}`, { token: adminToken });
  if (r.scope !== 'clinic') throw new Error(`scope=${r.scope}`);
  if (!r.clinic?._id) throw new Error('no clinic');
  return `clinic=${r.clinic.name}`;
});

await check('GET /admin/overview rejects patient role with 403', async () => {
  const { status } = await call('GET', '/admin/overview', {
    token: patientToken,
    expectStatus: 403,
  });
  return `status=${status}`;
});

await check('GET /admin/clinics (admin) returns the full clinic list', async () => {
  const r = await call('GET', '/admin/clinics', { token: adminToken });
  if (!Array.isArray(r.clinics) || r.clinics.length < 1) throw new Error('empty list');
  return `clinics=${r.clinics.length}`;
});

await check('GET /admin/overview rejects unauthenticated calls', async () => {
  const { status } = await call('GET', '/admin/overview', { expectStatus: 401 });
  return `status=${status}`;
});

console.log('\n[phase 3.2 staff management]');
let invitedStaffId;
const inviteSuffix = String(ts).slice(-5);
await check('POST /admin/staff/invite (admin) creates a clinician', async () => {
  const r = await call('POST', '/admin/staff/invite', {
    token: adminToken,
    body: {
      name: 'Smoke Clinician',
      phone: `+25471111${inviteSuffix}`,
      password: 'StaffPass123',
      role: 'clinician',
      clinicId,
    },
  });
  if (!r.user?.id) throw new Error('no user');
  if (r.user.role !== 'clinician') throw new Error(`role=${r.user.role}`);
  invitedStaffId = r.user.id;
  return `id=${invitedStaffId}`;
});

await check('GET /admin/staff (admin) lists invited member', async () => {
  const r = await call('GET', `/admin/staff?clinicId=${clinicId}`, { token: adminToken });
  if (!r.staff.some((s) => s._id === invitedStaffId)) throw new Error('not listed');
  return `count=${r.staff.length}`;
});

await check('PATCH /admin/staff/:id/role promotes to clinic_admin', async () => {
  const r = await call('PATCH', `/admin/staff/${invitedStaffId}/role`, {
    token: adminToken,
    body: { role: 'clinic_admin' },
  });
  if (r.user.role !== 'clinic_admin') throw new Error(`role=${r.user.role}`);
  return 'promoted';
});

await check('POST /admin/staff/invite rejects patient role', async () => {
  const { status } = await call('POST', '/admin/staff/invite', {
    token: patientToken,
    expectStatus: 403,
    body: { name: 'X', phone: '+254700000999', password: 'XXXXXXXX', role: 'clinician' },
  });
  return `status=${status}`;
});

await check('PATCH /admin/staff/:id/role refuses to change own role', async () => {
  // Get the admin user id from /auth/me
  const me = await call('GET', '/auth/me', { token: adminToken });
  const { status } = await call('PATCH', `/admin/staff/${me.user.id}/role`, {
    token: adminToken,
    expectStatus: 400,
    body: { role: 'clinician' },
  });
  return `status=${status}`;
});

await check('DELETE /admin/staff/:id soft-removes the staff member', async () => {
  const r = await call('DELETE', `/admin/staff/${invitedStaffId}`, { token: adminToken });
  if (!r.ok) throw new Error('not ok');
  return 'removed';
});

console.log('\n[phase 4.1 reporting]');
await check('GET /admin/reports/monthly.csv (admin, all) returns CSV', async () => {
  const now = new Date();
  const res = await fetch(
    `${BASE}/admin/reports/monthly.csv?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  if (!res.ok) throw new Error(`status=${res.status}`);
  const text = await res.text();
  if (!text.startsWith('metric,value')) throw new Error('bad header');
  if (!text.includes('appointments_total')) throw new Error('no metric');
  return `bytes=${text.length}`;
});

await check('GET /admin/reports/monthly.csv?clinicId= scopes to one clinic', async () => {
  const now = new Date();
  const res = await fetch(
    `${BASE}/admin/reports/monthly.csv?year=${now.getFullYear()}&month=${now.getMonth() + 1}&clinicId=${clinicId}`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  if (!res.ok) throw new Error(`status=${res.status}`);
  const text = await res.text();
  if (!text.includes('scope,clinic')) throw new Error('not scoped');
  return 'scoped';
});

await check('GET /admin/reports/monthly.csv requires year+month', async () => {
  const { status } = await call('GET', '/admin/reports/monthly.csv', {
    token: adminToken,
    expectStatus: 400,
  });
  return `status=${status}`;
});

await check('GET /admin/reports/monthly.csv rejects patient role', async () => {
  const now = new Date();
  const { status } = await call(
    'GET',
    `/admin/reports/monthly.csv?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
    { token: patientToken, expectStatus: 403 }
  );
  return `status=${status}`;
});

console.log('\n[phase 3.4 audit viewer]');
await check('GET /admin/audit (admin) returns chained entries', async () => {
  const r = await call('GET', '/admin/audit', { token: adminToken });
  if (!Array.isArray(r.entries)) throw new Error('no entries array');
  // Phase 3.2 staff invites should have produced rows.
  if (r.entries.length === 0) throw new Error('expected at least one audit entry');
  return `entries=${r.entries.length}`;
});

await check('GET /admin/audit?action=staff.invite filters', async () => {
  const r = await call('GET', '/admin/audit?action=staff.invite', { token: adminToken });
  if (r.entries.some((e) => e.action !== 'staff.invite')) throw new Error('filter leaked');
  return `matched=${r.entries.length}`;
});

await check('GET /admin/audit rejects patient role', async () => {
  const { status } = await call('GET', '/admin/audit', {
    token: patientToken,
    expectStatus: 403,
  });
  return `status=${status}`;
});

console.log('\n[phase 4.2 donor pdf]');
await check('GET /admin/reports/monthly/html returns donor report', async () => {
  const now = new Date();
  const res = await fetch(
    `${BASE}/admin/reports/monthly/html?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  if (!res.ok) throw new Error(`status=${res.status}`);
  const html = await res.text();
  if (!/donor/i.test(html)) throw new Error('missing donor keyword');
  if (!html.includes('@page')) throw new Error('missing print css');
  return `bytes=${html.length}`;
});

await check('GET /admin/reports/monthly/html requires year+month', async () => {
  const { status } = await call('GET', '/admin/reports/monthly/html', {
    token: adminToken,
    expectStatus: 400,
  });
  return `status=${status}`;
});

await check('GET /admin/reports/monthly/html rejects patient role', async () => {
  const now = new Date();
  const { status } = await call(
    'GET',
    `/admin/reports/monthly/html?year=${now.getFullYear()}&month=${now.getMonth() + 1}`,
    { token: patientToken, expectStatus: 403 }
  );
  return `status=${status}`;
});

console.log('\n[phase 5.1 self-cancel + reminders]');
let cancelApptId;
await check('Patient books a fresh appointment for cancel test', async () => {
  // Use a brand-new patient so we don't trip the one-active-booking rule
  // that the existing patientToken already holds for teleconsult.
  const cancelPhone = `+25471111${String(ts).slice(-4)}`;
  const reg = await call('POST', '/auth/register', {
    body: { phone: cancelPhone, password: 'test1234', name: 'Cancel Smoke', language: 'en' },
  });
  const r = await call('POST', '/appointments', {
    token: reg.token,
    body: { clinicId, reason: 'cancel smoke' },
  });
  if (!r.appointment?._id) throw new Error('no appointment id');
  cancelApptId = r.appointment._id;
  // Stash the throwaway token for the follow-up cancels.
  cancelApptId = r.appointment._id;
  globalThis.__cancelToken = reg.token;
  return `id=${cancelApptId}`;
});

await check('POST /appointments/:id/cancel (owner) cancels', async () => {
  const r = await call('POST', `/appointments/${cancelApptId}/cancel`, {
    token: globalThis.__cancelToken,
  });
  if (r.appointment?.status !== 'cancelled') throw new Error(`status=${r.appointment?.status}`);
  return 'cancelled';
});

await check('POST /appointments/:id/cancel again -> 404 (already not waiting)', async () => {
  const { status } = await call('POST', `/appointments/${cancelApptId}/cancel`, {
    token: globalThis.__cancelToken,
    expectStatus: 404,
  });
  return `status=${status}`;
});

await check('POST /appointments/:id/cancel without auth -> 401', async () => {
  const { status } = await call('POST', `/appointments/${cancelApptId}/cancel`, {
    expectStatus: 401,
  });
  return `status=${status}`;
});

console.log('\n[phase 6.2 OTP login]');
await check('POST /auth/otp/request rejects malformed phone', async () => {
  const { status } = await call('POST', '/auth/otp/request', {
    body: { phone: 'not-a-phone' },
    expectStatus: 400,
  });
  return `status=${status}`;
});
await check('POST /auth/otp/request returns ok=true for unknown phone (no enumeration)', async () => {
  const r = await call('POST', '/auth/otp/request', {
    body: { phone: '+254700999999' },
  });
  if (r.ok !== true) throw new Error('missing ok');
  if (r.devOtp) throw new Error('leaked devOtp for unknown phone');
  return 'ok';
});
await check('OTP request → verify happy path returns JWT', async () => {
  // Register a throwaway patient first.
  const otpPhone = `+25472${String(ts).slice(-9)}`;
  await call('POST', '/auth/register', {
    body: { phone: otpPhone, password: 'pw-otp-12', name: 'OTP Smoke' },
  });
  const reqRes = await call('POST', '/auth/otp/request', { body: { phone: otpPhone } });
  if (!reqRes.devOtp) throw new Error('expected devOtp from stub adapter');
  const verRes = await call('POST', '/auth/otp/verify', {
    body: { phone: otpPhone, code: reqRes.devOtp },
  });
  if (!verRes.token || verRes.user?.phone !== otpPhone) throw new Error('bad verify response');
  return `token len=${verRes.token.length}`;
});
await check('OTP verify with wrong code -> 401', async () => {
  const otpPhone = `+25473${String(ts).slice(-9)}`;
  await call('POST', '/auth/register', {
    body: { phone: otpPhone, password: 'pw-otp-12', name: 'OTP Smoke 2' },
  });
  await call('POST', '/auth/otp/request', { body: { phone: otpPhone } });
  const { status } = await call('POST', '/auth/otp/verify', {
    body: { phone: otpPhone, code: '000000' },
    expectStatus: 401,
  });
  return `status=${status}`;
});

console.log('\n[phase 3.5 clinic self-onboarding]');
let onboardId;
let onboardToken;
await check('POST /onboarding/clinic/request creates pending app', async () => {
  const email = `clinic+${ts}@onboard.example`;
  const r = await call('POST', '/onboarding/clinic/request', {
    body: {
      clinicName: `Smoke Clinic ${ts}`,
      address: '1 Smoke Rd',
      hours: '08:00 - 17:00',
      services: ['general'],
      lng: 35.6, lat: 3.7,
      adminName: 'Smoke Admin',
      adminEmail: email,
      adminPhone: `+25474${String(ts).slice(-9)}`,
      password: 'onboardpw12',
    },
  });
  if (!r.ok || !r.id) throw new Error('missing ok/id');
  if (!r.devVerifyToken) throw new Error('expected devVerifyToken');
  onboardId = r.id;
  onboardToken = r.devVerifyToken;
  return `id=${onboardId}`;
});
await check('GET /onboarding/verify/:token marks email_verified', async () => {
  const r = await call('GET', `/onboarding/verify/${onboardToken}`);
  if (!r.ok) throw new Error('not ok');
  return 'verified';
});
await check('POST /onboarding/applications/:id/approve creates clinic + admin', async () => {
  const r = await call('POST', `/onboarding/applications/${onboardId}/approve`, {
    token: adminToken,
  });
  if (!r.ok || !r.clinicId || !r.adminUserId) throw new Error('approve missing fields');
  return `clinicId=${String(r.clinicId).slice(-6)}`;
});
await check('Non-admin cannot list onboarding applications -> 403', async () => {
  const { status } = await call('GET', '/onboarding/applications', {
    token: patientToken,
    expectStatus: 403,
  });
  return `status=${status}`;
});

console.log('\n[phase 4.3 payment providers]');
await check('GET /donations/providers lists stub + stripe + daraja + flutterwave', async () => {
  const r = await call('GET', '/donations/providers');
  const ids = (r.providers || []).map((p) => p.id).sort();
  for (const want of ['daraja', 'flutterwave', 'stripe', 'stub']) {
    if (!ids.includes(want)) throw new Error(`missing ${want}`);
  }
  return `default=${r.defaultProvider}`;
});
await check('POST /donations/checkout?provider=stripe -> 503 when STRIPE_SECRET_KEY unset', async () => {
  const { status } = await call('POST', '/donations/checkout', {
    body: { amountUsd: 25, currency: 'USD', provider: 'stripe' },
    expectStatus: 503,
  });
  return `status=${status}`;
});

console.log('\n[guard checks - these MUST still fail safely]');
await check('POST /sos without address rejects (validation)', async () => {
  const { status } = await call('POST', '/sos', {
    token: patientToken,
    body: { clinicId, message: 'no address' },
    expectStatus: 400,
  });
  return `status=${status}`;
});

await check('POST /auth/login with wrong password rejects', async () => {
  const { status } = await call('POST', '/auth/login', {
    body: { identifier: adminPhone, password: 'definitely-wrong' },
    expectStatus: 401,
  });
  return `status=${status}`;
});

console.log('\n--- summary ---');
console.log(`${PASS} ${passed} passed`);
if (failed) {
  console.log(`${FAIL} ${failed} failed`);
  for (const f of failures) console.log(`   ${f.label}: ${f.err?.message || f.err}`);
  process.exit(1);
}
console.log('\nOK Smoke');
