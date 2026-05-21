import { describe, it, expect } from 'vitest';
import { renderPrescriptionHtml } from '../src/services/prescriptionRender.js';

const fixture = {
  year: 2026,
  prescriptionNumber: 7,
  issuedAt: new Date('2026-05-15T10:00:00Z'),
  patientName: 'Jane <Doe>', // intentionally contains HTML special chars
  patientAge: 32,
  patientSex: 'F',
  patientPhone: '+254700000000',
  prescriberName: 'Dr Smith',
  prescriberRole: 'clinician',
  diagnosis: 'Acute bronchitis',
  notes: 'Recheck in 1 week.',
  items: [
    { drug: 'Amoxicillin', dose: '500mg', frequency: 'TID', route: 'oral', durationDays: 7, quantity: '21', instructions: 'after meals' },
    { drug: 'Paracetamol', dose: '500mg', frequency: 'PRN' },
  ],
};

const clinic = { name: 'Hope Camp Clinic', city: 'Kakuma', country: 'Kenya' };

describe('renderPrescriptionHtml', () => {
  const html = renderPrescriptionHtml(fixture, clinic);

  it('embeds the formatted prescription number', () => {
    expect(html).toContain('2026-0007');
  });

  it('lists every prescribed drug', () => {
    expect(html).toContain('Amoxicillin');
    expect(html).toContain('Paracetamol');
  });

  it('uses A5 page size for the printable layout', () => {
    expect(html).toMatch(/@page[^}]*A5/);
  });

  it('escapes HTML in patient and clinic data to prevent XSS', () => {
    expect(html).toContain('Jane &lt;Doe&gt;');
    expect(html).not.toContain('<Doe>');
  });

  it('joins dose · frequency · route in the dosing column', () => {
    expect(html).toContain('500mg · TID · oral');
  });

  it('renders the clinic name in the header', () => {
    expect(html).toContain('Hope Camp Clinic');
  });
});
