// Renders a self-contained printable HTML prescription. Uses @page A5 + a
// "Save as PDF" button so clinicians can print to paper or to PDF without
// needing a server-side PDF library (pdfkit install was network-blocked at
// the time of writing). Architecture mirrors transparency.js so swapping in
// pdfkit later only requires a new render function — the route shape and
// model don't change.

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

export function renderPrescriptionHtml(prescription, clinic) {
  const issuedAt = new Date(prescription.issuedAt).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const number = `${prescription.year}-${String(prescription.prescriptionNumber).padStart(4, '0')}`;
  const itemsHtml = prescription.items.map((it, idx) => `
    <tr>
      <td class="num">${idx + 1}</td>
      <td>
        <div class="drug">${escapeHtml(it.drug)}</div>
        ${it.instructions ? `<div class="instr">${escapeHtml(it.instructions)}</div>` : ''}
      </td>
      <td>${escapeHtml([it.dose, it.frequency, it.route].filter(Boolean).join(' · '))}</td>
      <td>${escapeHtml(it.durationDays ? `${it.durationDays} day${it.durationDays === 1 ? '' : 's'}` : '')}</td>
      <td>${escapeHtml(it.quantity || '')}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Prescription ${escapeHtml(number)}</title>
<style>
  @page { size: A5 portrait; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 0; padding: 24px; line-height: 1.4; }
  .sheet { max-width: 720px; margin: 0 auto; }
  header { display: flex; justify-content: space-between; gap: 16px; padding-bottom: 12px; border-bottom: 2px solid #0d9488; }
  header h1 { margin: 0; color: #0d9488; font-size: 22px; letter-spacing: 0.4px; }
  header .meta { text-align: right; font-size: 11px; color: #475569; }
  header .meta strong { color: #0f172a; font-size: 13px; display: block; }
  .clinic { font-size: 12px; color: #475569; margin-top: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin: 16px 0; font-size: 12px; }
  .grid dt { color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: 0.4px; }
  .grid dd { margin: 0 0 4px 0; font-weight: 600; }
  .rx-mark { font-size: 36px; font-weight: 800; color: #0d9488; margin: 8px 0 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 12px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.4px; }
  td.num { color: #94a3b8; width: 24px; }
  .drug { font-weight: 700; }
  .instr { font-size: 11px; color: #475569; margin-top: 2px; }
  .notes { margin-top: 16px; font-size: 12px; }
  .notes strong { display: block; color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: 0.4px; margin-bottom: 4px; }
  .signature { margin-top: 32px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: flex-end; font-size: 12px; }
  .signature .label { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  .signature .name { font-weight: 700; font-size: 14px; }
  .footer { margin-top: 18px; font-size: 10px; color: #94a3b8; text-align: center; }
  .actions { text-align: center; margin: 16px 0; }
  .actions button { background: #0d9488; color: white; border: 0; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
  @media print { .actions { display: none; } body { padding: 0; } }
</style>
</head>
<body>
<div class="sheet">
  <div class="actions"><button onclick="window.print()">Save as PDF / Print</button></div>
  <header>
    <div>
      <h1>${escapeHtml(clinic?.name || 'AfyaConnect Clinic')}</h1>
      <div class="clinic">${escapeHtml(clinic?.address || '')}${clinic?.phone ? ` · ${escapeHtml(clinic.phone)}` : ''}</div>
    </div>
    <div class="meta">
      <strong>Prescription</strong>
      №&nbsp;${escapeHtml(number)}<br/>
      ${escapeHtml(issuedAt)}
    </div>
  </header>

  <dl class="grid">
    <div><dt>Patient</dt><dd>${escapeHtml(prescription.patientName)}</dd></div>
    <div><dt>Age / Sex</dt><dd>${escapeHtml([prescription.patientAge ? `${prescription.patientAge}y` : '', prescription.patientSex || ''].filter(Boolean).join(' · ') || '—')}</dd></div>
    ${prescription.patientPhone ? `<div><dt>Phone</dt><dd>${escapeHtml(prescription.patientPhone)}</dd></div>` : ''}
    ${prescription.diagnosis ? `<div><dt>Diagnosis</dt><dd>${escapeHtml(prescription.diagnosis)}</dd></div>` : ''}
  </dl>

  <div class="rx-mark">℞</div>
  <table>
    <thead>
      <tr><th></th><th>Medication</th><th>Dose · Freq · Route</th><th>Duration</th><th>Qty</th></tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  ${prescription.notes ? `<div class="notes"><strong>Notes</strong>${escapeHtml(prescription.notes)}</div>` : ''}

  <div class="signature">
    <div>
      <div class="label">Prescribed by</div>
      <div class="name">${escapeHtml(prescription.prescriberName)}</div>
      <div style="color:#64748b;font-size:11px">${escapeHtml(prescription.prescriberRole)}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Signature</div>
      <div style="height:36px;width:160px;border-bottom:1px solid #94a3b8"></div>
    </div>
  </div>

  <div class="footer">
    Generated by AfyaConnect on ${escapeHtml(new Date().toLocaleString('en-GB'))}.
    Verify authenticity with the issuing clinic before dispensing.
  </div>
</div>
</body>
</html>`;
}
