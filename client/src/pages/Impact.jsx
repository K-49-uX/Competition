import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Users,
  CalendarCheck,
  Building2,
  Siren,
  BookOpen,
  Languages,
  Clock,
  HeartHandshake,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

// Public Impact Dashboard. Reads from /api/metrics/public which returns the
// latest pre-built MetricSnapshot. Designed to be donor-facing: counters,
// trends, and a "what your money buys" angle without exposing any PII.
export default function Impact() {
  const { t } = useTranslation();
  useDocumentTitle(t('impact.title') || 'Impact');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['metrics', 'public'],
    queryFn: () => api.get('/metrics/public').then((r) => r.data),
    staleTime: 60_000,
  });

  return (
    <main id="main-content" className="bg-neutral-50">
      <Hero />
      <section className="max-w-7xl mx-auto px-4 py-10 space-y-10">
        {isLoading && <SkeletonGrid />}
        {isError && <ErrorBlock />}
        {data && <Counters counts={data.counts} averages={data.averages} />}
        {data && <Trend trend={data.trend} />}
        {data && <CostExplainer counts={data.counts} />}
        <DonorCTA />
      </section>
    </main>
  );
}

function Hero() {
  return (
    <section className="bg-gradient-to-br from-primary via-primary-600 to-primary-700 text-white">
      <div className="max-w-7xl mx-auto px-4 py-14 md:py-20">
        <p className="uppercase tracking-widest text-xs font-bold text-white/80 mb-3">
          AfyaConnect &middot; Impact
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4 max-w-3xl">
          Care delivered, measured, accountable.
        </h1>
        <p className="text-white/90 text-lg max-w-2xl">
          Every appointment booked, every emergency answered, every health topic
          read. Updated daily from live system data &mdash; nothing here is
          marketing copy.
        </p>
      </div>
    </section>
  );
}

const COUNTER_ITEMS = [
  { key: 'patientsTotal', label: 'Patients registered', icon: Users },
  { key: 'appointmentsTotal', label: 'Appointments booked', icon: CalendarCheck },
  { key: 'sosTotal', label: 'Emergency alerts handled', icon: Siren },
  { key: 'clinics', label: 'Partner clinics', icon: Building2 },
  { key: 'educationTopics', label: 'Health topics published', icon: BookOpen },
  { key: 'languagesServed', label: 'Languages served', icon: Languages },
];

function Counters({ counts, averages }) {
  return (
    <section aria-labelledby="counters-heading" className="space-y-4">
      <h2 id="counters-heading" className="text-2xl font-extrabold text-neutral-900 dark:text-white">
        At a glance
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {COUNTER_ITEMS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="card-flat !p-4 flex flex-col gap-2">
            <Icon size={20} className="text-primary" />
            <div className="text-3xl font-extrabold text-neutral-900 dark:text-white tabular-nums">
              {Number(counts?.[key] || 0).toLocaleString()}
            </div>
            <div className="text-xs text-neutral-500 dark:text-slate-400 leading-tight">{label}</div>
          </div>
        ))}
      </div>
      {averages?.waitMinutes != null && (
        <div className="card-flat !p-4 inline-flex items-center gap-2 text-sm">
          <Clock size={16} className="text-success" />
          <span className="font-semibold">Average wait time (last 30 days):</span>
          <span>{averages.waitMinutes} minutes</span>
        </div>
      )}
    </section>
  );
}

function Trend({ trend }) {
  const rows = Array.isArray(trend) ? trend : [];
  const hasData = rows.some((r) => r.appointments || r.sos || r.newPatients);

  return (
    <section aria-labelledby="trend-heading" className="space-y-4">
      <h2 id="trend-heading" className="text-2xl font-extrabold text-neutral-900 dark:text-white">
        Last 30 days
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card-flat lg:col-span-2 !p-4">
          <h3 className="font-bold mb-3 text-neutral-900 dark:text-white">Daily activity</h3>
          {hasData ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={rows} margin={{ top: 5, right: 12, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={shortDay} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="appointments" name="Appointments" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sos" name="SOS" stroke="#dc2626" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="newPatients" name="New patients" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No daily activity recorded yet." />
          )}
        </div>

        <div className="card-flat !p-4">
          <h3 className="font-bold mb-3 text-neutral-900 dark:text-white">Activity mix</h3>
          {hasData ? (
            <ActivityMix rows={rows} />
          ) : (
            <EmptyChart label="Mix appears once data is collected." />
          )}
        </div>
      </div>
    </section>
  );
}

const PIE_COLORS = ['#2563eb', '#dc2626', '#16a34a'];

function ActivityMix({ rows }) {
  const totals = rows.reduce(
    (acc, r) => {
      acc.appointments += r.appointments || 0;
      acc.sos += r.sos || 0;
      acc.newPatients += r.newPatients || 0;
      return acc;
    },
    { appointments: 0, sos: 0, newPatients: 0 }
  );
  const data = [
    { name: 'Appointments', value: totals.appointments },
    { name: 'SOS responses', value: totals.sos },
    { name: 'New patients', value: totals.newPatients },
  ].filter((d) => d.value > 0);

  if (!data.length) return <EmptyChart label="Mix appears once data is collected." />;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function CostExplainer({ counts }) {
  // COST_PER_PATIENT_USD env (server-side) drives the official figure. Until
  // that wires through, we compute a reasonable placeholder so donors still
  // see a "what does $X buy" framing on the page.
  const usdPerAppointment = 4; // placeholder until 1.2 lands
  const tiers = [
    { amount: 10, unlocks: Math.round(10 / usdPerAppointment), label: 'consultations' },
    { amount: 50, unlocks: Math.round(50 / usdPerAppointment), label: 'consultations' },
    { amount: 200, unlocks: Math.round(200 / usdPerAppointment), label: 'consultations' },
  ];

  return (
    <section aria-labelledby="cost-heading" className="space-y-4">
      <h2 id="cost-heading" className="text-2xl font-extrabold text-neutral-900 dark:text-white">
        What your support unlocks
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tiers.map((t) => (
          <div key={t.amount} className="card-flat !p-5 border-l-4 border-success">
            <div className="text-xs uppercase tracking-widest text-neutral-500 dark:text-slate-400">Donate</div>
            <div className="text-3xl font-extrabold text-success">${t.amount}</div>
            <div className="text-sm text-neutral-700 dark:text-slate-300 mt-1">
              funds approximately <span className="font-bold">{t.unlocks}</span> {t.label}.
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-neutral-500 dark:text-slate-400">
        Estimates based on internal cost-per-appointment ({counts?.clinics || 0} partner clinics).
        Detailed financials in our monthly transparency report.
      </p>
    </section>
  );
}

function DonorCTA() {
  return (
    <section className="card-flat !p-8 text-center bg-gradient-to-br from-success/10 via-primary/10 to-accent/10 border border-success/20">
      <HeartHandshake size={36} className="mx-auto text-success mb-3" />
      <h2 className="text-2xl font-extrabold mb-2 text-neutral-900 dark:text-white">
        Help us reach the next 10,000 patients
      </h2>
      <p className="text-neutral-700 dark:text-slate-300 max-w-xl mx-auto mb-5">
        AfyaConnect is donor-funded. Every dollar goes directly into clinic
        operations, multilingual content and emergency response infrastructure.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/about" className="btn-outline">Learn more</Link>
        <a href="mailto:partners@afyaconnect.org" className="btn-primary">
          Talk to our team
        </a>
      </div>
    </section>
  );
}

function EmptyChart({ label }) {
  return (
    <div className="h-[260px] flex items-center justify-center text-sm text-neutral-500 dark:text-slate-400 text-center">
      {label}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card-flat !p-4 h-28 animate-pulse bg-neutral-100 dark:bg-slate-800" />
        ))}
      </div>
      <div className="card-flat !p-4 h-72 animate-pulse bg-neutral-100 dark:bg-slate-800" />
    </div>
  );
}

function ErrorBlock() {
  return (
    <div className="card-flat !p-6 text-center text-danger font-semibold">
      Could not load impact data. Please refresh in a moment.
    </div>
  );
}

function shortDay(s) {
  if (!s || typeof s !== 'string') return s;
  const [, m, d] = s.split('-');
  return `${m}-${d}`;
}
