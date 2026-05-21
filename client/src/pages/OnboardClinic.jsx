import { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Mail, MapPin, KeyRound, Loader2, Check } from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../components/ui/Toast.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

// Phase 3.5 — Public clinic self-onboarding form. Two surfaces in one
// component: the application form, and (when ?token= is in the URL) the
// email-verification confirmation. Keeps routing to a single public page.
export default function OnboardClinic() {
  const { t } = useTranslation();
  useDocumentTitle(t('onboard.title'));
  const [params] = useSearchParams();
  const verifyToken = params.get('token');
  if (verifyToken) return <VerifyEmail token={verifyToken} />;
  return <ApplicationForm />;
}

function ApplicationForm() {
  const { t } = useTranslation();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [form, setForm] = useState({
    clinicName: '', address: '', hours: '08:00 - 17:00', services: '',
    lng: '', lat: '',
    adminName: '', adminEmail: '', adminPhone: '', password: '',
  });
  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        services: form.services.split(',').map((s) => s.trim()).filter(Boolean),
        lng: form.lng ? Number(form.lng) : undefined,
        lat: form.lat ? Number(form.lat) : undefined,
      };
      const { data } = await api.post('/onboarding/clinic/request', payload);
      setSubmitted(data);
      push(t('onboard.submitted'), 'success');
    } catch (e) {
      const code = e?.response?.data?.error;
      if (code === 'application_pending') push(t('onboard.duplicate'), 'error');
      else if (code === 'email_in_use') push(t('onboard.emailInUse'), 'error');
      else push(t('common.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-4rem)] grid place-items-center px-4 py-10">
        <div className="card w-full max-w-md text-center">
          <Check className="mx-auto text-primary mb-3" size={40} />
          <h1 className="text-2xl font-extrabold mb-2">{t('onboard.submittedTitle')}</h1>
          <p className="text-sm text-neutral-900/70">{t('onboard.submittedBody')}</p>
          {submitted.devVerifyToken && (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 text-sm text-left">
              <strong>Dev:</strong> Email is stubbed. Verify directly via{' '}
              <Link
                to={`/onboard-clinic?token=${submitted.devVerifyToken}`}
                className="underline font-mono break-all"
              >
                /onboard-clinic?token={submitted.devVerifyToken}
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10">
      <div className="max-w-2xl mx-auto card">
        <h1 className="text-2xl font-extrabold mb-1">{t('onboard.title')}</h1>
        <p className="text-sm text-neutral-900/70 mb-6">{t('onboard.subtitle')}</p>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field icon={<Building2 size={16} />} label={t('onboard.clinicName')} required value={form.clinicName} onChange={update('clinicName')} />
          <Field label={t('onboard.hours')} value={form.hours} onChange={update('hours')} />
          <Field className="md:col-span-2" icon={<MapPin size={16} />} label={t('onboard.address')} value={form.address} onChange={update('address')} />
          <Field label={t('onboard.lng')} type="number" step="any" value={form.lng} onChange={update('lng')} />
          <Field label={t('onboard.lat')} type="number" step="any" value={form.lat} onChange={update('lat')} />
          <Field className="md:col-span-2" label={t('onboard.services')} value={form.services} onChange={update('services')} placeholder="general, maternal, pharmacy" />
          <hr className="md:col-span-2 my-1 border-neutral-200" />
          <Field label={t('onboard.adminName')} required value={form.adminName} onChange={update('adminName')} />
          <Field icon={<Mail size={16} />} label={t('onboard.adminEmail')} type="email" required value={form.adminEmail} onChange={update('adminEmail')} />
          <Field label={t('onboard.adminPhone')} type="tel" value={form.adminPhone} onChange={update('adminPhone')} placeholder="+254700000000" />
          <Field icon={<KeyRound size={16} />} label={t('onboard.password')} type="password" required minLength={8} value={form.password} onChange={update('password')} />
          <div className="md:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary w-full text-lg !py-3">
              {busy ? <Loader2 className="inline animate-spin" size={18} /> : t('onboard.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, icon, className = '', ...rest }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">{icon}</span>}
        <input className={`input ${icon ? 'pl-9' : ''}`} {...rest} />
      </div>
    </div>
  );
}

function VerifyEmail({ token }) {
  const { t } = useTranslation();
  const [state, setState] = useState('verifying');
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    api.get(`/onboarding/verify/${token}`)
      .then(() => setState('ok'))
      .catch(() => setState('err'));
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-4rem)] grid place-items-center px-4 py-10">
      <div className="card w-full max-w-md text-center">
        {state === 'verifying' && <p>{t('common.loading')}</p>}
        {state === 'ok' && (
          <>
            <Check className="mx-auto text-primary mb-3" size={40} />
            <h1 className="text-2xl font-extrabold mb-2">{t('onboard.verifiedTitle')}</h1>
            <p className="text-sm text-neutral-900/70">{t('onboard.verifiedBody')}</p>
          </>
        )}
        {state === 'err' && (
          <>
            <h1 className="text-2xl font-extrabold mb-2">{t('onboard.verifyFailedTitle')}</h1>
            <p className="text-sm text-neutral-900/70">{t('onboard.verifyFailedBody')}</p>
          </>
        )}
      </div>
    </div>
  );
}
