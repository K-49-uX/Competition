import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { getSocket } from '../realtime/socket.js';
import { useToast } from '../components/ui/Toast.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function Queue() {
  useDocumentTitle('My queue');
  const { t } = useTranslation();
  const { token } = useAuth();
  const qc = useQueryClient();
  const { push } = useToast();
  const [selectedClinic, setSelectedClinic] = useState('');
  const [liveQueue, setLiveQueue] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  const { data: clinics } = useQuery({
    queryKey: ['clinics'],
    queryFn: () => api.get('/clinics').then((r) => r.data.clinics),
  });

  const { data: appts, refetch: refetchAppts } = useQuery({
    queryKey: ['appointments', 'me'],
    queryFn: () => api.get('/appointments/me').then((r) => r.data.appointments),
  });

  const active = useMemo(
    () => appts?.find((a) => a.status === 'waiting' || a.status === 'serving'),
    [appts]
  );
  const clinicId = active?.clinicId?._id || active?.clinicId;

  // Subscribe to live queue updates for the active clinic
  useEffect(() => {
    if (!clinicId || !token) return;
    const socket = getSocket(token);
    socket.emit('clinic:join', String(clinicId));
    const handler = (payload) => {
      if (String(payload.clinicId) === String(clinicId)) setLiveQueue(payload);
    };
    socket.on('queue:update', handler);
    // Also fetch initial state
    api.get(`/queue/${clinicId}`).then((r) => setLiveQueue(r.data)).catch(() => {});
    return () => socket.off('queue:update', handler);
  }, [clinicId, token]);

  async function book() {
    if (!selectedClinic) return;
    try {
      await api.post('/appointments', { clinicId: selectedClinic });
      qc.invalidateQueries({ queryKey: ['appointments', 'me'] });
      refetchAppts();
      push(t('queue.title'), 'success');
    } catch {
      push(t('common.error'), 'error');
    }
  }

  async function cancel() {
    if (!active) return;
    setCancelBusy(true);
    try {
      await api.post(`/appointments/${active._id}/cancel`);
      qc.invalidateQueries({ queryKey: ['appointments', 'me'] });
      push('Appointment cancelled', 'success');
    } catch {
      push(t('common.error'), 'error');
    } finally {
      setCancelBusy(false);
      setConfirmCancel(false);
    }
  }

  const ticket = active?.ticketNumber;
  const serving = liveQueue?.currentlyServing ?? 0;
  const ahead = ticket ? Math.max(0, ticket - serving) : 0;
  const avg = liveQueue?.avgServiceMinutes ?? active?.clinicId?.avgServiceMinutes ?? 8;
  const eta = ahead * avg;
  const progress = ticket ? Math.min(100, (serving / ticket) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 lg:py-12 space-y-5">
      <h1 className="text-3xl font-extrabold text-neutral-900">{t('queue.title')}</h1>

      {active ? (
        <div className="card !border-l-success">
          <div className="text-xs uppercase tracking-wide text-neutral-900/60 mb-1">
            {active.clinicId?.name}
          </div>
          <div className="text-6xl font-extrabold text-primary text-center my-4">
            #{ticket}
          </div>
          <div className="text-center text-sm text-neutral-900/70 mb-3">
            {t('queue.nowServing', { n: serving })} · {t('queue.ahead', { n: ahead })}
          </div>
          <div className="w-full bg-neutral-50 rounded-pill h-3 overflow-hidden mb-3">
            <div
              className="bg-success h-3 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-center text-sm font-semibold text-success mb-4">
            {t('home.estimatedWait', { minutes: eta })}
          </div>
          <button onClick={() => setConfirmCancel(true)} className="btn-outline w-full">
            {t('queue.cancel')}
          </button>
        </div>
      ) : (
        <div className="card">
          <p className="text-sm text-neutral-700 dark:text-slate-300 mb-4">
            {t('home.noAppointment')}
          </p>
          <Link to="/book" className="btn-primary w-full">
            {t('home.bookAppointment')} →
          </Link>
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel appointment?"
        message="This will release your spot in the queue. You'll need to book again if you change your mind."
        confirmLabel="Cancel appointment"
        cancelLabel="Keep it"
        tone="danger"
        busy={cancelBusy}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={cancel}
      />
    </div>
  );
}
