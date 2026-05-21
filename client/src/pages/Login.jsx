import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeartPulse, User as UserIcon, Stethoscope } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { LangToggle } from '../components/ui/LangToggle.jsx';
import { PasswordInput } from '../components/ui/PasswordInput.jsx';
import { useToast } from '../components/ui/Toast.jsx';

const STAFF_ROLES = ['clinician', 'clinic_admin', 'admin'];

function LoginCard({ variant }) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { push } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const isStaff = variant === 'staff';
  const Icon = isStaff ? Stethoscope : UserIcon;
  const title = isStaff
    ? t('auth.staffTitle') || 'Staff sign in'
    : t('auth.patientTitle') || 'Patient sign in';
  const subtitle = isStaff
    ? t('auth.staffSub') || 'For clinicians, clinic admins, and platform admins.'
    : t('auth.patientSub') || 'Book appointments, join the queue, and manage your visits.';
  const accent = isStaff
    ? 'from-accent/10 to-white border-accent/30'
    : 'from-primary-50 to-white border-primary/30';
  const badge = isStaff
    ? 'bg-accent/15 text-accent'
    : 'bg-primary-50 text-primary';
  const idAuto = `identifier-${variant}`;
  const pwAuto = `password-${variant}`;

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const u = await login({ identifier: identifier.trim(), password });
      const role = u?.role;
      if (isStaff && !STAFF_ROLES.includes(role)) {
        push(t('auth.notStaff') || 'This account is a patient account. Please use the patient form.', 'error');
        return;
      }
      if (!isStaff && STAFF_ROLES.includes(role)) {
        push(t('auth.notPatient') || 'This account is a staff account. Please use the staff form.', 'error');
        return;
      }
      const fallback = STAFF_ROLES.includes(role) ? '/admin' : '/app';
      const to = location.state?.from?.pathname || fallback;
      navigate(to, { replace: true });
    } catch (err) {
      const code = err?.response?.data?.error;
      let msg;
      if (code === 'invalid_credentials') msg = t('auth.invalid');
      else if (code === 'too_many_attempts') msg = t('auth.tooMany') || 'Too many attempts. Please wait a few minutes and try again.';
      else if (code === 'validation') msg = t('auth.invalid');
      else if (!err?.response) msg = t('auth.network') || 'Cannot reach the server. Check your connection and try again.';
      else msg = t('common.error');
      push(msg, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-col rounded-card border bg-gradient-to-br ${accent} shadow-card p-6 sm:p-8`}>
      <div className="flex items-center gap-3 mb-1">
        <span className={`grid place-items-center w-10 h-10 rounded-xl ${badge}`}>
          <Icon size={20} strokeWidth={2.4} />
        </span>
        <h2 className="text-2xl font-extrabold text-neutral-900">{title}</h2>
      </div>
      <p className="text-sm text-neutral-900/70 mb-5">{subtitle}</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor={idAuto}>{t('auth.identifier')}</label>
          <input
            id={idAuto}
            className="input"
            type="text"
            autoComplete="username"
            placeholder={t('auth.identifierPlaceholder')}
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>
        <div>
          <div className="flex justify-between items-end">
            <label className="label" htmlFor={pwAuto}>{t('auth.password')}</label>
            <Link to="/forgot-password" className="text-sm text-primary font-semibold hover:underline">
              {t('auth.forgot')}
            </Link>
          </div>
          <PasswordInput
            id={pwAuto}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className={isStaff ? 'btn-outline w-full !py-3 text-base' : 'btn-primary w-full !py-3 text-base'}
        >
          {busy
            ? t('common.loading')
            : isStaff
              ? (t('auth.staffLogin') || 'Sign in as staff')
              : (t('auth.patientLogin') || 'Sign in as patient')}
        </button>
      </form>
      {!isStaff ? (
        <>
          <p className="text-center text-sm text-neutral-900/70 mt-3">
            <Link to="/login/otp" className="text-primary font-semibold underline">
              {t('auth.otpLink')}
            </Link>
          </p>
          <p className="text-center text-sm text-neutral-900/70 mt-3">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-primary font-semibold underline">
              {t('auth.register')}
            </Link>
          </p>
        </>
      ) : (
        <p className="text-center text-xs text-neutral-900/60 mt-3">
          {t('auth.staffHint') || 'Staff accounts are created by your clinic administrator.'}
        </p>
      )}
    </div>
  );
}

export default function Login() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <header className="bg-white border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-primary text-white">
              <HeartPulse size={20} strokeWidth={2.4} />
            </span>
            <span className="font-extrabold text-primary text-lg">{t('app.name')}</span>
          </Link>
          <LangToggle compact />
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 mb-2">
              {t('auth.welcomeBack')}
            </h1>
            <p className="text-neutral-900/70">
              {t('auth.chooseAccount') || 'Choose how you want to sign in.'}
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LoginCard variant="patient" />
            <LoginCard variant="staff" />
          </div>
        </div>
      </main>
    </div>
  );
}
