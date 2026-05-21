import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, CalendarCheck, ClipboardList,
  Hospital, Pill, Users, Loader2, Download, Printer,
} from 'lucide-react';
import { api, openAuthenticatedHtml } from '../../api/client.js';
import { useAuth } from '../../auth/AuthProvider.jsx';

// Phase 3.1 — clinic dashboard. Shows superadmins an "All clinics" rollup
// (with a clinic switcher) and clinic-scoped staff their own clinic's
// metrics. Pure read-only; deeper drill-downs live on the existing
// appointments/queue pages this page links to.
export default function AdminDashboard() {
  const { user } = useAuth();
  const isSuper = user?.role === 'admin';

  // Superadmins get a switcher so they can scope a single clinic on demand.
  // (Stored in URL hash so a deep link can preserve the chosen clinic.)
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const selectedClinic = params.get('clinic') || '';

  const clinicsQuery = useQuery({
    queryKey: ['admin-clinics-mine'],
    queryFn: () => api.get('/admin/clinics').then((r) => r.data.clinics || []),
    staleTime: 60_000,
  });

  const overviewQuery = useQuery({
    queryKey: ['admin-overview', selectedClinic],
    queryFn: () =>
      api
        .get('/admin/overview', { params: selectedClinic ? { clinicId: selectedClinic } : {} })
        .then((r) => r.data),
    refetchInterval: 30_000,
  });

  function setClinic(id) {
    const next = new URLSearchParams();
    if (id) next.set('clinic', id);
    window.location.hash = next.toString();
  }

  if (overviewQuery.isPending) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }
  if (overviewQuery.isError) {
    return <div className="card text-danger">Could not load dashboard.</div>;
  }

  const o = overviewQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold inline-flex items-center gap-2">
            <Activity className="text-primary" size={22} />
            {o.scope === 'all' ? 'All clinics overview' : o.clinic?.name || 'Clinic overview'}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-slate-400">
            {o.scope === 'clinic' && o.clinic
              ? o.clinic.address || ''
              : 'Aggregated across every partner clinic.'}
          </p>
        </div>
        {isSuper && (clinicsQuery.data?.length || 0) > 0 && (
          <div className="flex items-center gap-2">
            <Hospital size={16} className="text-neutral-500" />
            <select
              className="input !py-1.5 text-sm"
              value={selectedClinic}
              onChange={(e) => setClinic(e.target.value)}
            >
              <option value="">All clinics</option>
              {clinicsQuery.data.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Booked today" value={o.today.booked} icon={CalendarCheck} tone="primary" />
        <Stat label="Waiting" value={o.today.waiting} icon={ClipboardList} tone="amber" />
        <Stat label="Urgent waiting" value={o.triage.urgentWaiting} icon={AlertTriangle} tone={o.triage.urgentWaiting > 0 ? 'danger' : 'neutral'} pulse={o.triage.urgentWaiting > 0} />
        <Stat label="Prescriptions today" value={o.today.prescriptionsIssued} icon={Pill} tone="primary" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="font-bold mb-3">Today's status mix</h2>
          <ul className="space-y-1.5 text-sm">
            <Bar label="Waiting" n={o.today.waiting} total={o.today.booked} tone="bg-amber-500" />
            <Bar label="Serving" n={o.today.serving} total={o.today.booked} tone="bg-primary" />
            <Bar label="Completed" n={o.today.completed} total={o.today.booked} tone="bg-success-500" />
            <Bar label="Cancelled" n={o.today.cancelled} total={o.today.booked} tone="bg-neutral-400" />
          </ul>
          <div className="mt-3 pt-3 border-t border-neutral-100">
            <Link to="/admin/appointments" className="text-sm text-primary font-semibold hover:underline">
              Open inbox →
            </Link>
          </div>
        </div>

        <div className="card">
          <h2 className="font-bold mb-3 inline-flex items-center gap-2">
            <Users size={16} className="text-primary" /> Staff &amp; queue
          </h2>
          <div className="space-y-2 text-sm">
            <Row label="Active clinical staff" value={o.staff.total} />
            {o.queue && (
              <>
                <Row label="Now serving" value={`#${o.queue.nowServing}`} />
                <Row label="Last ticket" value={`#${o.queue.lastTicket}`} />
              </>
            )}
            <Row label="Critical waiting" value={o.triage.bySeverity?.critical || 0} />
            <Row label="High waiting" value={o.triage.bySeverity?.high || 0} />
          </div>
          <div className="mt-3 pt-3 border-t border-neutral-100">
            <Link to="/admin" className="text-sm text-primary font-semibold hover:underline">
              Open queue →
            </Link>
          </div>
        </div>
      </div>

      <div className="text-xs text-neutral-400 text-right flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={async () => {
            const now = new Date();
            const params = new URLSearchParams({
              year: String(now.getFullYear()),
              month: String(now.getMonth() + 1),
              ...(selectedClinic ? { clinicId: selectedClinic } : {}),
            });
            // Auth-protected CSV download via blob (same trick as the
            // prescription printable: localStorage tokens aren't sent on a
            // plain anchor click).
            const res = await api.get(`/admin/reports/monthly.csv?${params}`, { responseType: 'text' });
            const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = res.headers['content-disposition']?.match(/filename="([^"]+)"/)?.[1] || 'afya-report.csv';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
          }}
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <Download size={12} /> Monthly CSV
        </button>
        <button
          type="button"
          onClick={() => {
            const now = new Date();
            const params = new URLSearchParams({
              year: String(now.getFullYear()),
              month: String(now.getMonth() + 1),
              ...(selectedClinic ? { clinicId: selectedClinic } : {}),
            });
            // Opens an authenticated A4 print view in a new tab — the
            // user can then "Save as PDF" from the browser dialog.
            openAuthenticatedHtml(`/admin/reports/monthly/html?${params}`);
          }}
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <Printer size={12} /> Donor PDF
        </button>
        <span>Auto-refreshes every 30s · last update {new Date(o.generatedAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone = 'primary', pulse = false }) {
  const toneCls = {
    primary: 'bg-primary/10 text-primary',
    amber: 'bg-amber-100 text-amber-700',
    danger: 'bg-danger/10 text-danger',
    neutral: 'bg-neutral-100 text-neutral-600',
  }[tone];
  return (
    <div className={`card !p-4 ${pulse ? 'animate-pulse' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={`grid place-items-center w-9 h-9 rounded-lg ${toneCls}`}>
          <Icon size={18} />
        </span>
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="mt-2 text-xs uppercase tracking-wide text-neutral-500 font-bold">{label}</div>
    </div>
  );
}

function Bar({ label, n, total, tone }) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;
  return (
    <li>
      <div className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-bold">{n}{total > 0 ? ` · ${pct}%` : ''}</span>
      </div>
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mt-0.5">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between border-b border-neutral-50 pb-1 last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
