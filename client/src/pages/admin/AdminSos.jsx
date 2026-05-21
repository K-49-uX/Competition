import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { getSocket } from '../../realtime/socket.js';

export default function AdminSos() {
  const { token } = useAuth();
  const [live, setLive] = useState([]);

  const { data: history } = useQuery({
    queryKey: ['notifications', 'sos'],
    queryFn: () => api.get('/notifications/sos').then((r) => r.data.notifications),
  });

  useEffect(() => {
    const socket = getSocket(token);
    const handler = (event) => {
      setLive((l) => [event, ...l]);
      // Browser notification (best effort)
      if (window.Notification && Notification.permission === 'granted') {
        new Notification('🚨 EMERGENCY SOS', { body: event.message });
      }
    };
    socket.on('sos:new', handler);
    if (window.Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    return () => socket.off('sos:new', handler);
  }, [token]);

  const items = [...live, ...(history || [])];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-danger">🚨 SOS Feed</h1>
      <p className="text-sm text-neutral-900/70">Live alerts from patients in distress.</p>
      <div className="space-y-3">
        {items.length === 0 && <div className="card text-neutral-900/60">No alerts.</div>}
        {items.map((it) => {
          const id = it.id || it._id;
          const coords = it.location?.coordinates;
          return (
            <div key={id} className="card !border-l-danger">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="font-bold text-danger">{it.from?.name || it.payload?.name || 'Patient'}</div>
                  <div className="text-sm text-neutral-900/80">{it.message}</div>
                  {(it.address || it.payload?.address) && (
                    <div className="text-sm mt-1">
                      <span className="font-semibold">📍 Where:</span>{' '}
                      <span className="text-neutral-900/80">{it.address || it.payload?.address}</span>
                    </div>
                  )}
                  {(it.clinic?.name || it.payload?.clinicName) && (
                    <div className="text-xs text-neutral-900/60 mt-1">
                      Hospital requested: <span className="font-semibold">{it.clinic?.name || it.payload?.clinicName}</span>
                    </div>
                  )}
                  <div className="text-xs text-neutral-900/60 mt-1">
                    {it.from?.phone || it.payload?.phone}
                    {' · '}
                    {it.createdAt ? new Date(it.createdAt).toLocaleString() : ''}
                  </div>
                </div>
                {coords && (
                  <a
                    className="btn-outline text-xs"
                    href={`https://www.openstreetmap.org/?mlat=${coords[1]}&mlon=${coords[0]}#map=18/${coords[1]}/${coords[0]}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📍 Locate
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
