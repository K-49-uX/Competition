import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Download,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Transparency() {
  const { t } = useTranslation();
  useDocumentTitle(t('transparency.title') || 'Transparency reports');

  const { data, isPending, error } = useQuery({
    queryKey: ['transparency-list'],
    queryFn: () => api.get('/transparency').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <main id="main-content" className="bg-neutral-50">
      <Hero />
      <section className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <Pledge />

        {isPending && (
          <div className="card-flat !p-8 text-center">
            <Loader2 size={28} className="mx-auto animate-spin text-primary" />
            <p className="mt-3 text-sm text-neutral-500 dark:text-slate-400">Loading reports…</p>
          </div>
        )}

        {error && (
          <div className="card-flat !p-6 border-danger/30 bg-danger/5">
            <AlertCircle className="inline text-danger me-2" size={18} />
            We could not load the reports archive. Please try again later.
          </div>
        )}

        {data?.reports?.length === 0 && (
          <EmptyState />
        )}

        {data?.reports?.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-extrabold text-neutral-900 dark:text-white">Monthly reports</h2>
            <ul className="space-y-3">
              {data.reports.map((r) => (
                <ReportCard key={r.period} report={r} />
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

function Hero() {
  return (
    <section className="bg-gradient-to-br from-primary-700 via-primary to-success text-white">
      <div className="max-w-4xl mx-auto px-4 py-14 md:py-16">
        <ShieldCheck size={36} className="mb-3 opacity-90" />
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
          Transparency &amp; accountability
        </h1>
        <p className="text-white/90 text-lg mt-3 max-w-2xl">
          Every month we publish anonymised, audited numbers showing exactly what your support delivered.
        </p>
      </div>
    </section>
  );
}

function Pledge() {
  return (
    <div className="card-flat !p-5 grid sm:grid-cols-3 gap-3 text-sm">
      <Pillar
        icon={ShieldCheck}
        title="Privacy first"
        body="No patient identifiers ever leave aggregated rows. Sub-groups under five are omitted (k-anonymity)."
      />
      <Pillar
        icon={FileText}
        title="Reproducible"
        body="Numbers come from daily snapshots of the live platform; you can see the same data on /impact."
      />
      <Pillar
        icon={Calendar}
        title="On schedule"
        body="A new report is auto-published on the 1st of every month at 06:05 UTC."
      />
    </div>
  );
}

function Pillar({ icon: Icon, title, body }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-primary font-bold">
        <Icon size={16} />
        <span>{title}</span>
      </div>
      <p className="text-xs text-neutral-600 dark:text-slate-400 leading-relaxed">{body}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card-flat !p-8 text-center">
      <FileText size={36} className="mx-auto text-neutral-400 mb-3" />
      <h3 className="font-bold text-lg text-neutral-900 dark:text-white">First report coming soon</h3>
      <p className="text-sm text-neutral-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
        Our automated reports publish on the first of each month. In the meantime, view live numbers on the
        <Link to="/impact" className="text-primary font-semibold ms-1">impact dashboard</Link>.
      </p>
    </div>
  );
}

function ReportCard({ report }) {
  const monthName = MONTHS[report.month - 1] || '';
  const reportUrl = `/api/transparency/${report.year}/${report.month}/html`;
  return (
    <li className="card-flat !p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-primary font-extrabold text-lg">
          <FileText size={18} />
          {monthName} {report.year}
        </div>
        <div className="mt-2 text-xs text-neutral-500 dark:text-slate-400">
          Published {new Date(report.publishedAt).toLocaleDateString()}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-700 dark:text-slate-300">
          <Stat label="Patients seen" v={report.summary?.patientsServed} />
          <Stat label="Appointments" v={report.summary?.appointments} />
          <Stat label="SOS" v={report.summary?.sosResponses} />
          <Stat label="Clinics" v={report.summary?.clinicsActive} />
        </div>
      </div>
      <div className="flex sm:flex-col gap-2 shrink-0">
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-flex items-center justify-center gap-2"
        >
          <FileText size={16} /> View report
        </a>
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline inline-flex items-center justify-center gap-2"
          title="Open the printable version, then choose 'Save as PDF' in your browser"
        >
          <Download size={16} /> Save as PDF
        </a>
      </div>
    </li>
  );
}

function Stat({ label, v }) {
  return (
    <span><span className="font-bold text-neutral-900 dark:text-white">{Number(v || 0).toLocaleString()}</span> <span className="text-xs uppercase tracking-wider text-neutral-500 dark:text-slate-400">{label}</span></span>
  );
}
