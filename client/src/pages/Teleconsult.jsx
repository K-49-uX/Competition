import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Video, ArrowLeft, ExternalLink, Loader2, AlertTriangle, PhoneOff } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

// Patient + clinician video room. We embed Jitsi via iframe so no extra
// SDK is required — this keeps the bundle small and means a self-hosted
// Jitsi switch only requires changing JITSI_BASE_URL on the server.
//
// Patients see a join button that loads the iframe on click (autoplay
// permission requires a user gesture on most mobile browsers).
export default function Teleconsult() {
  useDocumentTitle('Tele-consult');
  const { id } = useParams();
  const { user } = useAuth();
  const { push } = useToast();
  const [joined, setJoined] = useState(false);
  const iframeRef = useRef(null);

  const isClinician = user?.role === 'clinician' || user?.role === 'admin';

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['teleconsult', id],
    queryFn: () => api.get(`/appointments/${id}/teleconsult`).then((r) => r.data),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const start = useMutation({
    mutationFn: () => api.post(`/appointments/${id}/teleconsult`).then((r) => r.data),
    onSuccess: () => {
      refetch();
      push('Tele-consult started.', 'success');
    },
    onError: () => push('Could not start tele-consult.', 'error'),
  });

  const end = useMutation({
    mutationFn: () => api.post(`/appointments/${id}/teleconsult/end`).then((r) => r.data),
    onSuccess: () => {
      setJoined(false);
      refetch();
      push('Call ended.', 'success');
    },
    onError: () => push('Could not end the call.', 'error'),
  });

  // Auto-join clinicians: if they navigated here, they intend to be in the room.
  useEffect(() => {
    if (isClinician && data?.teleconsult?.joinUrl && !joined) setJoined(true);
  }, [isClinician, data, joined]);

  if (isPending) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center text-neutral-500">
        <Loader2 size={20} className="animate-spin mx-auto mb-2" />
        Connecting…
      </div>
    );
  }

  // 404 == not started yet. For clinicians, show a "Start tele-consult" CTA.
  // For patients, ask them to wait — the clinician will start it when ready.
  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-4">
        <Link to={isClinician ? '/admin/appointments' : '/profile'} className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft size={14} /> Back
        </Link>
        <div className="card text-center">
          <Video size={36} className="mx-auto text-primary mb-3" />
          <h1 className="text-xl font-bold mb-1">Tele-consult not started yet</h1>
          {isClinician ? (
            <>
              <p className="text-sm text-neutral-600 dark:text-slate-400 mb-4">
                Click below to create a private video room for this appointment.
              </p>
              <button
                onClick={() => start.mutate()}
                disabled={start.isPending}
                className="btn-primary inline-flex items-center gap-2"
              >
                {start.isPending && <Loader2 size={14} className="animate-spin" />}
                <Video size={16} /> Start tele-consult
              </button>
            </>
          ) : (
            <p className="text-sm text-neutral-600 dark:text-slate-400">
              Your clinician hasn't opened the video room yet. This page will be ready once they start it — please refresh in a moment.
            </p>
          )}
        </div>
      </div>
    );
  }

  const { teleconsult } = data;
  const ended = !!teleconsult?.endedAt;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 lg:py-10 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to={isClinician ? '/admin/appointments' : '/profile'} className="inline-flex items-center gap-1 text-sm text-primary">
          <ArrowLeft size={14} /> Back
        </Link>
        <div className="flex items-center gap-2">
          <a href={teleconsult.joinUrl} target="_blank" rel="noopener noreferrer" className="btn-outline !py-1.5 text-xs inline-flex items-center gap-1">
            <ExternalLink size={12} /> Open in new tab
          </a>
          {isClinician && !ended && (
            <button onClick={() => end.mutate()} disabled={end.isPending} className="!py-1.5 text-xs inline-flex items-center gap-1 px-3 rounded-md bg-danger/10 text-danger hover:bg-danger/20">
              <PhoneOff size={12} /> End call
            </button>
          )}
        </div>
      </div>

      <header>
        <h1 className="text-2xl font-bold inline-flex items-center gap-2">
          <Video size={20} className="text-primary" /> Tele-consult
        </h1>
        <p className="text-sm text-neutral-500 dark:text-slate-400">
          Private video room. Use a quiet space and good lighting if possible.
        </p>
      </header>

      {ended ? (
        <div className="card-flat border-warning/40 bg-warning/5 text-sm">
          <AlertTriangle size={16} className="inline text-warning-600 me-1" />
          This call has ended. Ask your clinician to start a new one if needed.
        </div>
      ) : !joined ? (
        <div className="card text-center py-10">
          <Video size={36} className="mx-auto text-primary mb-3" />
          <h2 className="font-bold mb-1">You're invited to the consultation</h2>
          <p className="text-sm text-neutral-500 dark:text-slate-400 mb-4">
            Tap below to join the video room. Allow camera and microphone access when your browser asks.
          </p>
          <button onClick={() => setJoined(true)} className="btn-primary inline-flex items-center gap-2">
            <Video size={16} /> Join video call
          </button>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <iframe
            ref={iframeRef}
            title="Tele-consult video room"
            src={teleconsult.joinUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="w-full h-[70vh] min-h-[480px] border-0"
          />
        </div>
      )}

      <p className="text-xs text-neutral-400 dark:text-slate-500">
        Powered by Jitsi Meet. AfyaConnect does not record or store the call.
      </p>
    </div>
  );
}
