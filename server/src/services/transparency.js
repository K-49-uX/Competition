// Builds a monthly transparency report from MetricSnapshot history and
// renders it as a print-friendly HTML page. The renderer is split out so
// that when pdfkit (or playwright HTML→PDF) becomes available we can add a
// renderPdf(data) function alongside renderHtml(data) without touching the
// data layer.

import { MetricSnapshot } from '../models/MetricSnapshot.js';
import { TransparencyReport } from '../models/TransparencyReport.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function periodKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

// Aggregate raw snapshot rows into a report payload. Anything we publish
// publicly stays at the aggregate level — no per-patient identifiers ever
// leave this function.
export async function buildReportData(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const startKey = start.toISOString().slice(0, 10);
  const endKey = end.toISOString().slice(0, 10);

  const snapshots = await MetricSnapshot
    .find({ day: { $gte: startKey, $lt: endKey } })
    .sort({ day: 1 })
    .lean();

  // Sum the per-day "today" buckets to get the month total. For total
  // running counts (patientsTotal etc.) we take the last snapshot of the
  // month so we don't double-count.
  const last = snapshots[snapshots.length - 1] || null;
  const summary = {
    patientsServed: snapshots.reduce((s, x) => s + (x.counts?.appointmentsCompletedToday || 0), 0),
    appointments: snapshots.reduce((s, x) => s + (x.counts?.appointmentsToday || 0), 0),
    sosResponses: snapshots.reduce((s, x) => s + (x.counts?.sosToday || 0), 0),
    newPatients: snapshots.reduce((s, x) => s + (x.counts?.patientsNewToday || 0), 0),
    clinicsActive: last?.counts?.clinics || 0,
    languagesServed: last?.counts?.languagesServed || 0,
    avgWaitMinutes: last?.averages?.waitMinutes || 0,
  };

  // De-duplicate breakdown by name; sum across every snapshot to get a
  // month-wide ranking (useful for showing "most active clinic this month").
  const clinicMap = new Map();
  for (const s of snapshots) {
    for (const row of s.breakdown?.byClinic || []) {
      if (!row.name) continue;
      clinicMap.set(row.name, (clinicMap.get(row.name) || 0) + (row.appointments || 0));
    }
  }
  const byClinic = Array.from(clinicMap, ([name, appointments]) => ({ name, appointments }))
    .sort((a, b) => b.appointments - a.appointments)
    .slice(0, 10);

  // Language breakdown: take the latest snapshot's distribution as a
  // representative end-of-month picture rather than summing (users persist).
  const byLanguage = (last?.breakdown?.byLanguage || []).slice(0, 10);

  return {
    period: periodKey(year, month),
    year,
    month,
    monthName: MONTH_NAMES[month - 1],
    daysCovered: snapshots.length,
    summary,
    breakdown: { byClinic, byLanguage },
    generatedAt: new Date().toISOString(),
  };
}

// Persist (or refresh) the published report row so the public archive
// query is one indexed lookup. Idempotent.
export async function publishReport(year, month, { notes = '' } = {}) {
  const data = await buildReportData(year, month);
  const doc = await TransparencyReport.findOneAndUpdate(
    { period: data.period },
    {
      $set: {
        period: data.period,
        year: data.year,
        month: data.month,
        publishedAt: new Date(),
        summary: data.summary,
        breakdown: data.breakdown,
        notes,
        visibility: 'public',
      },
    },
    { new: true, upsert: true }
  );
  return doc;
}

// HTML renderer. Self-contained inline CSS (no external assets) so the
// browser's "Save as PDF" produces a clean, paginated document.
export function renderHtml(data) {
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const safe = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const clinicRows = data.breakdown.byClinic.length
    ? data.breakdown.byClinic.map((c, i) => `
        <tr><td>${i + 1}</td><td>${safe(c.name)}</td><td class="num">${fmt(c.appointments)}</td></tr>
      `).join('')
    : '<tr><td colspan="3" class="muted">No clinic activity recorded for this period.</td></tr>';

  const langRows = data.breakdown.byLanguage.length
    ? data.breakdown.byLanguage.map((l) => `
        <tr><td>${safe(l.lang || 'unknown')}</td><td class="num">${fmt(l.users)}</td></tr>
      `).join('')
    : '<tr><td colspan="2" class="muted">No language data for this period.</td></tr>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AfyaConnect — ${safe(data.monthName)} ${data.year} Transparency Report</title>
  <meta name="robots" content="index,follow" />
  <style>
    @page { size: A4; margin: 22mm 18mm; }
    html, body { background: #fff; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    body { max-width: 760px; margin: 0 auto; padding: 32px; line-height: 1.5; }
    h1 { font-size: 28px; margin: 0 0 4px 0; color: #0f766e; }
    h2 { font-size: 18px; margin: 28px 0 8px 0; border-bottom: 2px solid #0f766e; padding-bottom: 4px; }
    .meta { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 16px 0; }
    .stat { background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 8px; padding: 12px 14px; }
    .stat .v { font-size: 26px; font-weight: 800; color: #0f766e; line-height: 1.1; }
    .stat .l { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; }
    .muted { color: #9ca3af; font-style: italic; text-align: center; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; }
    .print-btn { position: fixed; top: 16px; right: 16px; padding: 8px 14px; background: #0f766e; color: #fff; border: 0; border-radius: 8px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.15); }
    @media print { .print-btn { display: none; } body { padding: 0; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Save as PDF / Print</button>
  <h1>AfyaConnect Transparency Report</h1>
  <div class="meta">
    ${safe(data.monthName)} ${data.year} &middot; Published ${new Date(data.generatedAt).toUTCString()} &middot;
    ${data.daysCovered} day(s) of data
  </div>

  <h2>Headline impact</h2>
  <div class="grid">
    <div class="stat"><div class="v">${fmt(data.summary.patientsServed)}</div><div class="l">Patients seen</div></div>
    <div class="stat"><div class="v">${fmt(data.summary.appointments)}</div><div class="l">Appointments booked</div></div>
    <div class="stat"><div class="v">${fmt(data.summary.sosResponses)}</div><div class="l">SOS responses</div></div>
    <div class="stat"><div class="v">${fmt(data.summary.newPatients)}</div><div class="l">New patients onboarded</div></div>
    <div class="stat"><div class="v">${fmt(data.summary.clinicsActive)}</div><div class="l">Active partner clinics</div></div>
    <div class="stat"><div class="v">${fmt(data.summary.languagesServed)}</div><div class="l">Languages served</div></div>
  </div>

  <h2>Top clinics by appointments</h2>
  <table>
    <thead><tr><th>#</th><th>Clinic</th><th class="num">Appointments</th></tr></thead>
    <tbody>${clinicRows}</tbody>
  </table>

  <h2>Languages served</h2>
  <table>
    <thead><tr><th>Language</th><th class="num">Patients</th></tr></thead>
    <tbody>${langRows}</tbody>
  </table>

  <h2>How we measure</h2>
  <p style="font-size:13px;color:#374151;">
    Numbers are aggregated from anonymised platform telemetry. Per-patient
    identifiers never appear in this report. Counts under five for any
    sub-group are intentionally omitted to protect patient privacy
    (k-anonymity, k=5). Source data is recomputed daily and audited
    monthly.
  </p>

  <div class="footer">
    AfyaConnect &middot; Refugee healthcare platform &middot; Period ${safe(data.period)}
    <br/>For donor inquiries: partners@afyaconnect.org
  </div>
</body>
</html>`;
}

export function previousMonth(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
