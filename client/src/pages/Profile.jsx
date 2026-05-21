import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Camera, Trash2, User as UserIcon } from 'lucide-react';
import { api, openAuthenticatedHtml } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { LangToggle } from '../components/ui/LangToggle.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const STATUS_COLORS = {
  waiting: 'bg-primary-50 text-primary',
  serving: 'bg-success/10 text-success',
  completed: 'bg-neutral-50 text-neutral-900/60',
  cancelled: 'bg-danger/10 text-danger',
};

const MAX_AVATAR_BYTES = 600_000; // ~600 KB after downscaling
const AVATAR_MAX_DIMENSION = 384; // px on the longest side

// Downscale + re-encode an image File to a JPEG data URL no larger than ~600KB.
async function fileToAvatarDataUrl(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('not_an_image');
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('read_failed'));
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('decode_failed'));
    i.src = dataUrl;
  });
  const scale = Math.min(1, AVATAR_MAX_DIMENSION / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  // Try decreasing JPEG quality until under the limit.
  for (const q of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4]) {
    const out = canvas.toDataURL('image/jpeg', q);
    if (out.length <= MAX_AVATAR_BYTES) return out;
  }
  return canvas.toDataURL('image/jpeg', 0.4);
}

export default function Profile() {
  useDocumentTitle('Profile');
  const { t, i18n } = useTranslation();
  const { user, setUser, logout } = useAuth();
  const { push } = useToast();
  const [name, setName] = useState(user?.name || '');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const fileInputRef = useRef(null);

  const { data: appts } = useQuery({
    queryKey: ['appointments', 'me'],
    queryFn: () => api.get('/appointments/me').then((r) => r.data.appointments),
  });

  const qc = useQueryClient();
  const cancel = useMutation({
    // Patient self-cancel — server only flips status when caller owns the
    // appointment AND it's still in the 'waiting' state.
    mutationFn: (id) => api.post(`/appointments/${id}/cancel`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments', 'me'] });
      push('Appointment cancelled.', 'success');
    },
    onError: () => push('Could not cancel appointment.', 'error'),
  });

  async function save() {
    setBusy(true);
    try {
      const lang = i18n.language?.split('-')[0] || 'en';
      const { data } = await api.patch('/users/me', { name, language: lang });
      setUser(data.user);
      localStorage.setItem('afya.user', JSON.stringify(data.user));
      push(t('profile.saved'), 'success');
    } catch {
      push(t('common.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleAvatarPick(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    try {
      const avatarUrl = await fileToAvatarDataUrl(file);
      const { data } = await api.patch('/users/me', { avatarUrl });
      setUser(data.user);
      localStorage.setItem('afya.user', JSON.stringify(data.user));
      push('Profile photo updated', 'success');
    } catch (err) {
      const msg =
        err?.message === 'not_an_image'
          ? 'Please choose an image file (JPG, PNG, WebP).'
          : err?.response?.data?.error === 'avatar_too_large'
          ? 'Image is too large even after compression. Try a smaller photo.'
          : 'Could not update photo. Please try again.';
      push(msg, 'error');
    } finally {
      setAvatarBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      const { data } = await api.patch('/users/me', { avatarUrl: '' });
      setUser(data.user);
      localStorage.setItem('afya.user', JSON.stringify(data.user));
      push('Profile photo removed', 'success');
    } catch {
      push(t('common.error'), 'error');
    } finally {
      setAvatarBusy(false);
    }
  }

  const initial = user?.name?.[0]?.toUpperCase() || 'U';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 lg:py-12 space-y-5">
      <h1 className="text-3xl font-extrabold text-neutral-900 dark:text-white">{t('profile.title')}</h1>

      <div className="card">
        {/* Avatar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-6">
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-primary text-white grid place-items-center text-3xl font-extrabold ring-2 ring-primary-50 dark:ring-slate-700">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name || 'Profile'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span aria-hidden>{initial}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarBusy}
              className="absolute -bottom-1 -right-1 grid place-items-center w-9 h-9 rounded-full bg-accent text-white shadow-md hover:bg-accent-600 disabled:opacity-60"
              aria-label="Change profile photo"
              title="Change profile photo"
            >
              <Camera size={16} />
            </button>
          </div>

          <div className="flex-1">
            <div className="font-bold text-neutral-900 dark:text-white text-lg">
              {user?.name || '—'}
            </div>
            <div className="text-sm text-neutral-600 dark:text-slate-400">
              {user?.phone || user?.email || ''}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                className="btn-outline text-sm !py-2"
              >
                <Camera size={14} />
                {avatarBusy ? 'Uploading…' : (user?.avatarUrl ? 'Change photo' : 'Upload photo')}
              </button>
              {user?.avatarUrl && (
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: 'remove' })}
                  disabled={avatarBusy}
                  className="btn-ghost text-sm !py-2 !text-danger"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              )}
            </div>
            <p className="help-text mt-2">
              JPG, PNG or WebP. Photos are downscaled to a square ~384px.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handleAvatarPick}
          />
        </div>

        <label className="label">{t('auth.name')}</label>
        <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} />

        <div className="label">{t('profile.language')}</div>
        <LangToggle />

        <button onClick={save} disabled={busy} className="btn-primary w-full mt-4">
          {busy ? t('common.loading') : t('profile.save')}
        </button>
      </div>

      <div className="card">
        <h2 className="font-bold mb-3">{t('profile.history')}</h2>
        <ul className="space-y-2">
          {appts?.map((a) => (
            <li key={a._id} className="flex justify-between items-center border-b border-neutral-50 pb-2 last:border-0 gap-2">
              <div className="min-w-0">
                <div className="font-semibold">#{a.ticketNumber} · {a.clinicId?.name}</div>
                <div className="text-xs text-neutral-900/60">
                  {new Date(a.scheduledFor).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {a.teleconsult?.enabled && (
                  <a
                    href={`/teleconsult/${a._id}`}
                    className="text-xs font-semibold rounded-pill px-3 py-1 bg-primary text-white hover:bg-primary-600"
                  >
                    Join video
                  </a>
                )}
                {a.status === 'waiting' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Cancel this appointment?')) cancel.mutate(a._id);
                    }}
                    className="text-xs font-semibold rounded-pill px-3 py-1 border border-danger text-danger hover:bg-danger/10"
                    disabled={cancel.isPending}
                  >
                    Cancel
                  </button>
                )}
                <span className={`text-xs font-semibold rounded-pill px-3 py-1 ${STATUS_COLORS[a.status] || ''}`}>
                  {a.status}
                </span>
              </div>
            </li>
          ))}
          {(!appts || appts.length === 0) && <li className="text-neutral-900/60 text-sm">—</li>}
        </ul>
      </div>

      <MyHealthSection />

      <MyPrescriptionsSection />

      <button
        onClick={() => setConfirm({ kind: 'logout' })}
        className="btn-outline w-full !text-danger !border-danger"
      >
        {t('nav.logout')}
      </button>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.kind === 'logout' ? 'Sign out?' : 'Remove profile photo?'}
        message={
          confirm?.kind === 'logout'
            ? 'You will need to sign in again to access your appointments and notifications.'
            : 'Your photo will be removed from your profile. You can upload a new one anytime.'
        }
        confirmLabel={confirm?.kind === 'logout' ? 'Sign out' : 'Remove'}
        tone="danger"
        busy={avatarBusy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.kind === 'logout') {
            setConfirm(null);
            logout();
          } else {
            await removeAvatar();
            setConfirm(null);
          }
        }}
      />
    </div>
  );
}

// Patient-side read-only health summary. Pulls /api/patients/me/record which
// returns the patient's record + visit notes flagged patient_visible. If the
// endpoint isn't enabled (PATIENT_RECORD_ENABLED=false) or the patient has no
// record yet, we render a friendly empty state rather than an error.
function MyHealthSection() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['patients', 'me', 'record'],
    queryFn: () => api.get('/patients/me/record').then((r) => r.data),
    retry: false,
  });

  if (isPending) return null;
  if (isError) return null; // feature flag off — silently hide

  const { record, visits } = data;
  const hasAny =
    record.bloodType !== 'unknown' ||
    record.summary ||
    record.allergies?.length ||
    record.conditions?.length ||
    record.medications?.length ||
    record.immunisations?.length ||
    visits.length;

  return (
    <div className="card">
      <h2 className="font-bold mb-1">My health summary</h2>
      <p className="text-xs text-neutral-500 dark:text-slate-400 mb-3">
        Information your clinician has recorded. Read-only — talk to your clinician to update it.
      </p>

      {!hasAny ? (
        <p className="text-sm text-neutral-500 dark:text-slate-400 italic">
          No health information has been recorded yet.
        </p>
      ) : (
        <div className="space-y-3 text-sm">
          {record.bloodType && record.bloodType !== 'unknown' && (
            <Row label="Blood type" value={record.bloodType} />
          )}
          {record.summary && <Row label="Summary" value={record.summary} />}
          {record.allergies?.length > 0 && (
            <Row
              label="Allergies"
              value={record.allergies.map((a) => `${a.substance}${a.reaction ? ` (${a.reaction})` : ''}`).join(', ')}
            />
          )}
          {record.conditions?.length > 0 && (
            <Row
              label="Conditions"
              value={record.conditions.filter((c) => c.status === 'active').map((c) => c.name).join(', ') || record.conditions.map((c) => c.name).join(', ')}
            />
          )}
          {record.medications?.length > 0 && (
            <Row
              label="Medications"
              value={record.medications.filter((m) => !m.stoppedAt).map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ''}`).join(', ')}
            />
          )}
          {record.immunisations?.length > 0 && (
            <Row
              label="Immunisations"
              value={record.immunisations.map((im) => `${im.vaccine}${im.doseNumber ? ` (dose ${im.doseNumber})` : ''}`).join(', ')}
            />
          )}
          {visits.length > 0 && (
            <div className="pt-2 border-t border-neutral-100 dark:border-slate-800">
              <div className="font-semibold mb-1">Recent visits</div>
              <ul className="space-y-1">
                {visits.slice(0, 5).map((v) => (
                  <li key={v._id} className="text-xs text-neutral-700 dark:text-slate-300">
                    <span className="font-bold">{new Date(v.visitedAt).toLocaleDateString()}</span>
                    {v.chiefComplaint && ` — ${v.chiefComplaint}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <div className="text-neutral-500 dark:text-slate-400 text-xs uppercase tracking-wide font-bold pt-0.5">{label}</div>
      <div className="text-neutral-800 dark:text-slate-200">{value}</div>
    </div>
  );
}

// Patient prescriptions list. Each row links to the printable HTML the
// server renders (same endpoint clinicians use). Hidden silently if the
// feature is disabled or the patient has none.
function MyPrescriptionsSection() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['prescriptions', 'me'],
    queryFn: () => api.get('/prescriptions/me').then((r) => r.data),
    retry: false,
  });
  if (isPending || isError) return null;
  const items = data.prescriptions || [];
  if (items.length === 0) return null;
  return (
    <div className="card">
      <h2 className="font-bold mb-3">My prescriptions</h2>
      <ul className="space-y-2">
        {items.map((p) => (
          <li key={p._id} className="flex justify-between items-center border-b border-neutral-50 pb-2 last:border-0 gap-2">
            <div className="min-w-0">
              <div className="font-semibold">
                №&nbsp;{p.year}-{String(p.prescriptionNumber).padStart(4, '0')}
                {p.clinicId?.name && <span className="text-xs text-neutral-500 ms-2">{p.clinicId.name}</span>}
              </div>
              <div className="text-xs text-neutral-500">
                {new Date(p.issuedAt).toLocaleDateString()} · {p.items.length} medication{p.items.length === 1 ? '' : 's'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => openAuthenticatedHtml(`/prescriptions/${p._id}/html`)}
              className="text-xs font-semibold rounded-pill px-3 py-1 bg-primary text-white hover:bg-primary-600"
            >
              View
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
