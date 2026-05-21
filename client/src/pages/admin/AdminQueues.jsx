import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { getSocket } from '../../realtime/socket.js';
import { useToast } from '../../components/ui/Toast.jsx';

function ClinicCard({ clinic }) {
  const { t } = useTranslation();
  const { token } = useAuth();
  const { push } = useToast();
  const [state, setState] = useState({ currentlyServing: 0, lastIssued: 0 });

  useEffect(() => {
    api.get(`/queue/${clinic._id}`).then((r) => setState(r.data)).catch(() => {});
    const socket = getSocket(token);
    socket.emit('clinic:join', String(clinic._id));
    const handler = (payload) => {
      if (String(payload.clinicId) === String(clinic._id)) setState(payload);
    };
    socket.on('queue:update', handler);
    return () => socket.off('queue:update', handler);
  }, [clinic._id, token]);

  async function advance() {
    try {
      const { data } = await api.post(`/queue/${clinic._id}/advance`);
      setState(data);
    } catch {
      push(t('common.error'), 'error');
    }
  }

  const ahead = Math.max(0, state.lastIssued - state.currentlyServing);

  return (
    <div className="card">
      <div className="font-bold text-primary text-lg">{clinic.name}</div>
      <div className="text-xs text-neutral-900/60 mb-3">{clinic.address}</div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-neutral-50 rounded-lg p-3 text-center">
          <div className="text-xs uppercase text-neutral-900/60">Now</div>
          <div className="text-3xl font-extrabold text-success">#{state.currentlyServing}</div>
        </div>
        <div className="bg-neutral-50 rounded-lg p-3 text-center">
          <div className="text-xs uppercase text-neutral-900/60">Issued</div>
          <div className="text-3xl font-extrabold text-primary">#{state.lastIssued}</div>
        </div>
      </div>
      <div className="text-xs text-neutral-900/60 mb-3">{ahead} waiting</div>
      <button onClick={advance} className="btn-primary w-full">
        ▶ {t('admin.advance')}
      </button>
    </div>
  );
}

export default function AdminQueues() {
  const { data: clinics } = useQuery({
    queryKey: ['clinics'],
    queryFn: () => api.get('/clinics').then((r) => r.data.clinics),
  });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-primary">Live Queues</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {clinics?.map((c) => <ClinicCard key={c._id} clinic={c} />)}
      </div>
    </div>
  );
}
