import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Inbox, CalendarCheck } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { Skeleton, SkeletonText } from '../components/ui/Skeleton.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function Home() {
  useDocumentTitle('Dashboard');
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();

  const notesQ = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data.notifications),
  });
  const apptsQ = useQuery({
    queryKey: ['appointments', 'me'],
    queryFn: () => api.get('/appointments/me').then((r) => r.data.appointments),
  });

  const notes = notesQ.data;
  const appts = apptsQ.data;
  const active = appts?.find((a) => a.status === 'waiting' || a.status === 'serving');
  const isFetching = notesQ.isFetching || apptsQ.isFetching;

  function refresh() {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['appointments', 'me'] });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
      <div className="mb-8 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-neutral-900 dark:text-white">
            {t('home.welcome', { name: user?.name?.split(' ')[0] || '' })}
          </h1>
          <p className="text-neutral-700 dark:text-slate-300 mt-1">{t('home.subtitle')}</p>
        </div>
        <button
          onClick={refresh}
          disabled={isFetching}
          className="btn-outline text-sm !py-2"
          aria-label="Refresh dashboard"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active queue card spans 2 cols */}
        <Link to={active ? '/queue' : '/book'} className="card lg:col-span-2 hover:no-underline">
          <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-slate-400 mb-2">
            {t('queue.title')}
          </div>
          {apptsQ.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center py-2">
              <Skeleton className="h-16 w-32" />
              <div className="md:col-span-2 space-y-2">
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ) : active ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="text-center md:text-start">
                <div className="text-6xl font-extrabold text-primary dark:text-accent leading-none">
                  #{active.ticketNumber}
                </div>
                <div className="text-sm text-neutral-700 dark:text-slate-300 mt-2">
                  {active.clinicId?.name}
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-sm text-neutral-700 dark:text-slate-300 mb-2">
                  {t('home.viewLive')}
                </div>
                <div className="w-full bg-neutral-100 dark:bg-slate-800 rounded-pill h-3 overflow-hidden">
                  <div className="bg-success h-3" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-4">
              <div className="text-neutral-600 dark:text-slate-400">{t('home.noAppointment')}</div>
              <span className="btn-primary !py-2 !px-4 text-sm self-start md:self-auto">
                {t('home.bookAppointment')} →
              </span>
            </div>
          )}
        </Link>

        {/* Quick actions stack */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
          <Link to="/book" className="card text-center !p-6">
            <div className="text-4xl mb-2">📅</div>
            <div className="font-semibold">{t('home.bookAppointment')}</div>
          </Link>
          <Link to="/clinics" className="card text-center !p-6">
            <div className="text-4xl mb-2">📍</div>
            <div className="font-semibold">{t('home.clinicLocator')}</div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="card lg:col-span-2 !border-l-success">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg text-neutral-900 dark:text-white">📢 {t('home.announcements')}</h2>
          </div>
          {notesQ.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <SkeletonText lines={2} />
                </div>
              ))}
            </div>
          ) : (notes && notes.length > 0) ? (
            <ul className="divide-y divide-neutral-100 dark:divide-slate-800">
              {notes.slice(0, 5).map((n) => (
                <li key={n._id} className="py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={n.type === 'alert' ? 'chip-danger' : 'chip-success'}>
                      {n.type === 'alert' ? 'Alert' : 'Campaign'}
                    </span>
                    <span className="font-semibold text-neutral-900 dark:text-white">{n.title}</span>
                  </div>
                  <div className="text-sm text-neutral-700 dark:text-slate-300 mt-1">{n.message}</div>
                  {n.createdAt && (
                    <div className="text-xs text-neutral-500 dark:text-slate-400 mt-1">
                      {new Date(n.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={Inbox}
              title="No announcements yet"
              body="Health alerts and campaigns from your camp will appear here."
            />
          )}
        </div>

        <div className="card !border-l-primary">
          <h2 className="font-bold text-lg mb-3 text-neutral-900 dark:text-white">📚 {t('education.title')}</h2>
          <p className="text-sm text-neutral-700 dark:text-slate-300 mb-4">{t('home.eduTeaser')}</p>
          <Link to="/education" className="btn-outline text-sm">
            {t('home.exploreEdu')} →
          </Link>
        </div>
      </div>
    </div>
  );
}
