import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Building2, LocateFixed, AlertTriangle, Clock, ArrowLeft, Check } from 'lucide-react';
import { api } from '../../api/client.js';
import { useToast } from './Toast.jsx';
import { useAuth } from '../../auth/AuthProvider.jsx';

export function SOSButton({ variant = 'fab' }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState('pick'); // pick | location
  const [clinicId, setClinicId] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null);          // { lat, lng }
  const [locStatus, setLocStatus] = useState('idle');  // idle|locating|ok|denied|unavailable
  const [error, setError] = useState('');

  // Load partner clinics so the patient can choose where to send the alert.
  const { data: clinics, isLoading: clinicsLoading } = useQuery({
    queryKey: ['clinics'],
    queryFn: () => api.get('/clinics').then((r) => r.data.clinics),
    enabled: open,
  });

  const selectedClinic = clinics?.find((c) => c._id === clinicId) || null;

  function captureLocation() {
    if (!navigator.geolocation) { setLocStatus('unavailable'); return; }
    setLocStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus('ok');
      },
      (err) => {
        setLocStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 }
    );
  }

  // Auto-capture location when the patient advances to the location step.
  useEffect(() => {
    if (open && step === 'location' && locStatus === 'idle') captureLocation();
  }, [open, step, locStatus]);

  function reset() {
    setStep('pick');
    setClinicId('');
    setAddress('');
    setCoords(null);
    setLocStatus('idle');
    setError('');
    setSending(false);
  }

  function close() {
    if (sending) return;
    setOpen(false);
    reset();
  }

  function pickClinic(id) {
    setClinicId(id);
    setError('');
    setStep('location');
  }

  function backToPick() {
    if (sending) return;
    setStep('pick');
    setError('');
  }

  if (!user) return null;

  async function send() {
    setError('');
    if (!clinicId) {
      setError(t('sos.pickClinic') || 'Please choose the hospital you want help from.');
      return;
    }
    const trimmed = address.trim();
    if (trimmed.length < 3) {
      setError('Please describe where you are so responders can find you.');
      return;
    }
    setSending(true);
    try {
      await api.post('/sos', {
        clinicId,
        message: 'Emergency assistance needed',
        address: trimmed,
        ...(coords || {}),
      });
      push(t('sos.sent'), 'success');
      setOpen(false);
      reset();
    } catch (err) {
      const code = err?.response?.data?.error;
      setError(
        code === 'clinic_not_found'
          ? 'That hospital is no longer available. Please pick another.'
          : (t('sos.failed') || 'Could not send alert. Please try again.')
      );
      push(t('sos.failed'), 'error');
    } finally {
      setSending(false);
    }
  }

  const triggerClass =
    variant === 'navbar'
      ? 'inline-flex items-center gap-2 bg-danger text-white font-bold rounded-pill px-4 py-2 text-sm shadow-sos hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-danger/50'
      : 'fixed bottom-6 end-6 z-50 bg-danger text-white font-bold rounded-pill px-5 py-4 shadow-sos hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-danger/50';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('sos.button')}
        className={triggerClass}
      >
        🚨 <span className="hidden sm:inline">{variant === 'navbar' ? t('sos.short') : t('sos.button')}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="bg-white dark:bg-[#0e1729] rounded-card p-6 w-full max-w-2xl border-t-8 border-danger shadow-card max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-danger mb-1 flex items-center gap-2">
              <AlertTriangle size={22} /> {t('sos.confirmTitle')}
            </h2>
            <p className="text-sm text-neutral-700 dark:text-slate-300 mb-4">
              {t('sos.confirmBody')}
            </p>

            {/* Step indicator */}
            <ol className="flex items-center gap-2 mb-5 text-xs font-semibold">
              <li className={`flex items-center gap-1.5 ${step === 'pick' ? 'text-danger' : 'text-success'}`}>
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${step === 'pick' ? 'bg-danger text-white' : 'bg-success text-white'}`}>
                  {step === 'pick' ? '1' : <Check size={12} />}
                </span>
                Choose hospital
              </li>
              <li className="flex-1 h-px bg-neutral-200 dark:bg-slate-700" />
              <li className={`flex items-center gap-1.5 ${step === 'location' ? 'text-danger' : 'text-neutral-400'}`}>
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${step === 'location' ? 'bg-danger text-white' : 'bg-neutral-200 dark:bg-slate-700'}`}>2</span>
                Share location & send
              </li>
            </ol>

            {step === 'pick' && (
              <ClinicPicker
                clinics={clinics}
                loading={clinicsLoading}
                selectedId={clinicId}
                onPick={pickClinic}
              />
            )}

            {step === 'location' && (
              <>
                {/* Selected hospital banner */}
                <div className="card-flat mb-4 !p-3 border-l-4 border-danger">
                  <div className="flex items-start gap-2 text-sm">
                    <Building2 size={18} className="text-danger mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-neutral-900 dark:text-white">
                        {selectedClinic?.name}
                      </div>
                      {selectedClinic?.address && (
                        <div className="text-xs text-neutral-500 dark:text-slate-400">{selectedClinic.address}</div>
                      )}
                    </div>
                    <button type="button" onClick={backToPick} className="btn-ghost !py-1 !px-2 text-xs shrink-0">
                      Change
                    </button>
                  </div>
                </div>

                {/* Address (typed by patient) */}
                <label className="block mb-4">
                  <span className="label flex items-center gap-1.5">
                    <MapPin size={14} /> Where are you right now?
                    <span className="text-danger" aria-hidden>*</span>
                  </span>
                  <textarea
                    className="input min-h-[80px]"
                    placeholder="e.g. House no. 12, Mama Ngina Street, near Equity Bank, Nairobi"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    disabled={sending}
                    maxLength={500}
                    required
                  />
                  <span className="text-xs text-neutral-500 dark:text-slate-400 mt-1 block">
                    Add a street, building, landmark or apartment number so the team can reach you fast.
                  </span>
                </label>

                {/* Location status */}
                <div className="card-flat mb-4 !p-3 border-l-4 border-primary">
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin size={16} className="text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-neutral-900 dark:text-white">
                        Your GPS location
                      </div>
                      {locStatus === 'locating' && (
                        <div className="text-xs text-neutral-500 dark:text-slate-400">Locating you…</div>
                      )}
                      {locStatus === 'ok' && coords && (
                        <div className="text-xs text-neutral-600 dark:text-slate-400 break-all">
                          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} — sent with the alert
                        </div>
                      )}
                      {locStatus === 'denied' && (
                        <div className="text-xs text-warning">
                          Location permission denied. Responders won't know exactly where you are.
                        </div>
                      )}
                      {locStatus === 'unavailable' && (
                        <div className="text-xs text-warning">
                          Couldn't get your location. You can still send the alert.
                        </div>
                      )}
                    </div>
                    {(locStatus === 'denied' || locStatus === 'unavailable') && (
                      <button
                        type="button"
                        onClick={captureLocation}
                        className="btn-ghost !py-1 !px-2 text-xs shrink-0"
                      >
                        <LocateFixed size={12} /> Retry
                      </button>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-danger font-semibold mb-3" role="alert">{error}</div>
                )}

                <div className="flex gap-3">
                  <button type="button" disabled={sending} onClick={backToPick} className="btn-outline flex-1 inline-flex items-center justify-center gap-1">
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    type="button"
                    disabled={sending || address.trim().length < 3}
                    onClick={send}
                    className="btn-danger flex-1"
                  >
                    {sending ? '…' : t('sos.send')}
                  </button>
                </div>
              </>
            )}

            {step === 'pick' && (
              <div className="mt-4 flex justify-end">
                <button type="button" disabled={sending} onClick={close} className="btn-outline">
                  {t('sos.cancel')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ClinicPicker({ clinics, loading, selectedId, onPick }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card-flat !p-4 animate-pulse h-28 bg-neutral-100 dark:bg-slate-800" />
        ))}
      </div>
    );
  }
  if (!clinics?.length) {
    return (
      <div className="card-flat !p-4 text-sm text-neutral-600 dark:text-slate-400 text-center">
        No partner hospitals available right now.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {clinics.map((c) => {
        const active = selectedId === c._id;
        return (
          <button
            type="button"
            key={c._id}
            onClick={() => onPick(c._id)}
            className={`card-flat !p-4 text-start transition hover:border-danger hover:shadow-card focus:outline-none focus:ring-2 focus:ring-danger/40 ${active ? 'border-danger ring-2 ring-danger/40' : ''}`}
          >
            <div className="flex items-start gap-2">
              <Building2 size={18} className="text-danger mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-neutral-900 dark:text-white truncate">{c.name}</div>
                {c.address && (
                  <div className="text-xs text-neutral-500 dark:text-slate-400 truncate">{c.address}</div>
                )}
                {c.hours && (
                  <div className="text-xs text-neutral-500 dark:text-slate-400 mt-1 inline-flex items-center gap-1">
                    <Clock size={12} /> {c.hours}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-danger">
              {active ? <><Check size={12} /> Selected</> : 'Request help here →'}
            </div>
          </button>
        );
      })}
    </div>
  );
}
