import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { HeartPulse } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { LangToggle } from '../components/ui/LangToggle.jsx';
import { PasswordInput } from '../components/ui/PasswordInput.jsx';
import { useToast } from '../components/ui/Toast.jsx';

const ERR_MAP = {
  phone_in_use: 'auth.phoneInUse',
  email_in_use: 'auth.emailInUse',
  phone_or_email_required: 'auth.phoneOrEmailRequired',
};

export default function Register() {
  const { t, i18n } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const { push } = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', refugeeId: '', password: '' });
  const [busy, setBusy] = useState(false);

  function update(field) { return (e) => setForm((f) => ({ ...f, [field]: e.target.value })); }

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.email && !form.phone) {
      push(t('auth.phoneOrEmailRequired'), 'error');
      return;
    }
    setBusy(true);
    try {
      await register({ ...form, language: i18n.language?.split('-')[0] || 'en' });
      push(t('auth.registered'), 'success');
      navigate('/app', { replace: true });
    } catch (err) {
      const code = err?.response?.data?.error;
      const msgKey = ERR_MAP[code];
      push(msgKey ? t(msgKey) : (code || t('common.error')), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col bg-gradient-to-br from-primary via-primary-600 to-primary-700 text-white p-10 relative overflow-hidden">
        <Link to="/" className="flex items-center gap-2 z-10">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-white/15">
            <HeartPulse size={22} strokeWidth={2.4} />
          </span>
          <span className="font-extrabold text-xl">{t('app.name')}</span>
        </Link>
        <div className="m-auto z-10 max-w-md">
          <h2 className="text-4xl font-extrabold mb-4 leading-tight">{t('auth.joinTitle')}</h2>
          <p className="text-white/90 text-lg">{t('auth.joinSub')}</p>
        </div>
        <div className="absolute -bottom-20 -end-20 w-80 h-80 bg-white/10 rounded-full" />
      </aside>

      <div className="flex flex-col bg-white">
        <div className="flex justify-between items-center p-4 lg:p-6">
          <Link to="/" className="lg:hidden flex items-center gap-2">
            <span className="grid place-items-center w-9 h-9 rounded-xl bg-primary text-white">
              <HeartPulse size={20} strokeWidth={2.4} />
            </span>
            <span className="font-extrabold text-primary">{t('app.name')}</span>
          </Link>
          <span />
          <LangToggle compact />
        </div>
        <div className="flex-1 flex items-center justify-center px-4 pb-10">
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-extrabold text-neutral-900 mb-2">{t('auth.register')}</h1>
            <p className="text-neutral-900/70 mb-6">{t('auth.signupHint')}</p>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">{t('auth.name')}</label>
                <input className="input" required value={form.name} onChange={update('name')} />
              </div>
              <div>
                <label className="label">{t('auth.email')}</label>
                <input className="input" type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={update('email')} />
              </div>
              <div>
                <label className="label">{t('auth.phone')}</label>
                <input className="input" type="tel" autoComplete="tel" placeholder="+254700000000" value={form.phone} onChange={update('phone')} />
                <p className="text-xs text-neutral-900/60 mt-1">{t('auth.phoneOrEmailHint')}</p>
              </div>
              <div>
                <label className="label">{t('auth.refugeeId')}</label>
                <input className="input" value={form.refugeeId} onChange={update('refugeeId')} />
              </div>
              <div>
                <label className="label">{t('auth.password')}</label>
                <PasswordInput minLength={6} required value={form.password} onChange={update('password')} />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full text-lg !py-3">
                {busy ? t('common.loading') : t('auth.submit')}
              </button>
            </form>
            <p className="text-center text-sm text-neutral-900/70 mt-6">
              {t('auth.haveAccount')}{' '}
              <Link to="/login" className="text-primary font-semibold underline">{t('auth.login')}</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
