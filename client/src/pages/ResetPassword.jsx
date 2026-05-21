import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeartPulse } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { LangToggle } from '../components/ui/LangToggle.jsx';
import { PasswordInput } from '../components/ui/PasswordInput.jsx';
import { useToast } from '../components/ui/Toast.jsx';

export default function ResetPassword() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (password !== confirm) {
      push(t('auth.passwordMismatch'), 'error');
      return;
    }
    setBusy(true);
    try {
      await resetPassword({ token: token.trim(), password });
      push(t('auth.passwordReset'), 'success');
      navigate('/app', { replace: true });
    } catch (err) {
      const code = err?.response?.data?.error;
      push(code === 'invalid_or_expired_token' ? t('auth.tokenInvalid') : t('common.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <div className="flex justify-between items-center p-4 lg:p-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-primary text-white">
            <HeartPulse size={20} strokeWidth={2.4} />
          </span>
          <span className="font-extrabold text-primary">{t('app.name')}</span>
        </Link>
        <LangToggle compact />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-neutral-100 p-8">
          <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">{t('auth.resetTitle')}</h1>
          <p className="text-neutral-900/70 mb-6">{t('auth.resetSub')}</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">{t('auth.resetToken')}</label>
              <input className="input font-mono text-sm" required value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
            <div>
              <label className="label">{t('auth.newPassword')}</label>
              <PasswordInput minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="label">{t('auth.confirmPassword')}</label>
              <PasswordInput minLength={6} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full text-lg !py-3">
              {busy ? t('common.loading') : t('auth.resetSubmit')}
            </button>
          </form>

          <p className="text-center text-sm text-neutral-900/70 mt-6">
            <Link to="/login" className="text-primary font-semibold underline">{t('auth.backToLogin')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
