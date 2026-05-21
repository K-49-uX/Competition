import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, KeyRound, Loader2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useToast } from '../components/ui/Toast.jsx';

// Phase 6.2 — Passwordless OTP login. Two steps: request a code by phone,
// then submit the 6-digit code. The backend stamps `devOtp` on the response
// in dev (SMS stubbed) so testing locally requires no real phone.
export default function LoginOtp() {
  const { t } = useTranslation();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const [step, setStep] = useState('phone'); // 'phone' | 'code'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [devOtp, setDevOtp] = useState(null);

  async function requestCode(ev) {
    ev.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/otp/request', { phone: phone.trim() });
      // Server intentionally returns ok=true even for unknown phones to
      // avoid leaking which numbers exist; we still show the success UI.
      if (data?.devOtp) setDevOtp(data.devOtp); // dev-only convenience
      setStep('code');
      push(t('auth.otpSent'), 'success');
    } catch {
      push(t('common.error'), 'error');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(ev) {
    ev.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/otp/verify', {
        phone: phone.trim(),
        code: code.trim(),
      });
      setSession({ token: data.token, user: data.user });
      navigate('/home', { replace: true });
    } catch {
      push(t('auth.otpInvalid'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] grid place-items-center px-4 py-10">
      <div className="card w-full max-w-md">
        <h1 className="text-2xl font-extrabold mb-1">{t('auth.otpTitle')}</h1>
        <p className="text-sm text-neutral-900/70 mb-6">{t('auth.otpSub')}</p>

        {step === 'phone' && (
          <form onSubmit={requestCode} className="space-y-4">
            <div>
              <label className="label" htmlFor="otp-phone">{t('auth.otpPhone')}</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  id="otp-phone"
                  type="tel"
                  inputMode="tel"
                  required
                  className="input pl-9"
                  placeholder="+254700000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" disabled={busy} className="btn-primary w-full text-lg !py-3">
              {busy ? <Loader2 className="inline animate-spin" size={18} /> : t('auth.otpSend')}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verifyCode} className="space-y-4">
            {devOtp && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 text-sm">
                <strong>Dev:</strong> SMS is stubbed. Code is <code className="font-mono">{devOtp}</code>.
              </div>
            )}
            <div>
              <label className="label" htmlFor="otp-code">{t('auth.otpCode')}</label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  className="input pl-9 tracking-[0.5em] font-mono text-center text-xl"
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
            <button type="submit" disabled={busy || code.length !== 6} className="btn-primary w-full text-lg !py-3">
              {busy ? <Loader2 className="inline animate-spin" size={18} /> : t('auth.otpVerify')}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setCode(''); setDevOtp(null); }}
              className="w-full text-sm text-primary font-semibold hover:underline"
            >
              {t('auth.otpResend')}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-neutral-900/70 mt-6">
          <Link to="/login" className="text-primary font-semibold underline">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
