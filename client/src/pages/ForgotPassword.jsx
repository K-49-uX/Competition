import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeartPulse } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { LangToggle } from '../components/ui/LangToggle.jsx';
import { useToast } from '../components/ui/Toast.jsx';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { forgotPassword } = useAuth();
  const { push } = useToast();
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [devToken, setDevToken] = useState(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await forgotPassword(identifier.trim());
      setSent(true);
      if (data.devResetToken) setDevToken(data.devResetToken);
    } catch {
      push(t('common.error'), 'error');
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
          <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">{t('auth.forgotTitle')}</h1>
          <p className="text-neutral-900/70 mb-6">{t('auth.forgotSub')}</p>

          {!sent ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">{t('auth.identifier')}</label>
                <input
                  className="input"
                  type="text"
                  required
                  placeholder={t('auth.identifierPlaceholder')}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full text-lg !py-3">
                {busy ? t('common.loading') : t('auth.sendReset')}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-success/10 border border-success/30 text-success-700 p-4">
                <p className="font-semibold">{t('auth.resetSent')}</p>
                <p className="text-sm mt-1 text-neutral-900/70">{t('auth.resetSentBody')}</p>
              </div>

              {devToken && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm">
                  <p className="font-semibold text-amber-900 mb-1">{t('auth.devToken')}</p>
                  <p className="text-amber-900/80 mb-2">{t('auth.devTokenBody')}</p>
                  <code className="block break-all bg-white border border-amber-200 rounded px-2 py-1 text-xs">{devToken}</code>
                  <Link
                    to={`/reset-password?token=${encodeURIComponent(devToken)}`}
                    className="btn-primary inline-block mt-3"
                  >
                    {t('auth.useToken')}
                  </Link>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-sm text-neutral-900/70 mt-6">
            <Link to="/login" className="text-primary font-semibold underline">{t('auth.backToLogin')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
