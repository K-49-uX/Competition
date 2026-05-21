import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  HeartHandshake,
  Check,
  Mail,
  Phone,
  CreditCard,
  Smartphone,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useToast } from '../components/ui/Toast.jsx';

const TIERS = [
  { amount: 10, label: '$10', impact: 'Funds 2 patient consultations.' },
  { amount: 50, label: '$50', impact: 'Funds 10 consultations or 1 SOS response.', recommended: true },
  { amount: 200, label: '$200', impact: 'Stocks one clinic for a week.' },
];

const DESIGNATIONS = [
  { id: 'general', label: 'Where need is greatest' },
  { id: 'sos', label: 'Emergency response' },
  { id: 'clinic', label: 'Clinic operations' },
  { id: 'education', label: 'Health education' },
];

export default function Donate() {
  const { t } = useTranslation();
  useDocumentTitle(t('donate.title') || 'Support AfyaConnect');
  const { push } = useToast();

  const [amount, setAmount] = useState(50);
  const [custom, setCustom] = useState('');
  const [designation, setDesignation] = useState('general');
  const [recurring, setRecurring] = useState(false);
  const [provider, setProvider] = useState('auto');
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donorPhone, setDonorPhone] = useState('');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState(null);

  const checkout = useMutation({
    mutationFn: async () => {
      const finalAmount = custom ? Number(custom) : amount;
      if (!Number.isFinite(finalAmount) || finalAmount < 1) throw new Error('amount_invalid');
      const body = {
        amountUsd: finalAmount,
        designation,
        recurring,
        donorName: donorName || undefined,
        donorEmail: donorEmail || undefined,
        donorPhone: donorPhone || undefined,
      };
      if (provider === 'mpesa') { body.provider = 'daraja'; body.currency = 'KES'; }
      else if (provider === 'card') { body.provider = 'stripe'; }
      const { data } = await api.post('/donations/checkout', body);
      return data;
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        if (data.provider === 'daraja') {
          push(data.instructions || 'Check your phone for the M-Pesa prompt', 'info', 6000);
        }
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (err) => {
      const code = err?.response?.data?.error || err?.message;
      push(
        code === 'amount_invalid' ? 'Please enter a valid amount.' :
        code === 'phone_required' ? 'M-Pesa donations need a phone number.' :
        'Could not start checkout. Please try again.',
        'error'
      );
    },
  });

  const newsletter = useMutation({
    mutationFn: () => api.post('/donations/subscribe', {
      email: newsletterEmail.trim().toLowerCase(),
      source: 'donate-page',
    }).then((r) => r.data),
    onSuccess: () => { setNewsletterStatus('ok'); setNewsletterEmail(''); },
    onError: () => { setNewsletterStatus('err'); },
  });

  const submit = (e) => { e.preventDefault(); checkout.mutate(); };

  return (
    <main id="main-content" className="bg-neutral-50">
      <Hero />
      <section className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form onSubmit={submit} className="card-flat !p-6 lg:col-span-3 space-y-5">
          <div>
            <h2 className="text-xl font-extrabold text-neutral-900 dark:text-white mb-1">
              Make a donation
            </h2>
            <p className="text-sm text-neutral-500 dark:text-slate-400">
              100% of your gift goes to clinic operations and emergency response.
            </p>
          </div>

          <fieldset>
            <legend className="label">Amount (USD)</legend>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {TIERS.map((tier) => {
                const active = !custom && amount === tier.amount;
                return (
                  <button
                    type="button"
                    key={tier.amount}
                    onClick={() => { setAmount(tier.amount); setCustom(''); }}
                    className={`card-flat !p-3 text-start transition focus:outline-none focus:ring-2 focus:ring-primary/40 ${active ? 'border-primary ring-2 ring-primary/30' : 'hover:border-primary'}`}
                  >
                    <div className="text-2xl font-extrabold text-primary">{tier.label}</div>
                    <div className="text-xs text-neutral-500 dark:text-slate-400 leading-tight mt-1">{tier.impact}</div>
                    {tier.recommended && (
                      <span className="inline-block mt-2 text-[10px] uppercase tracking-widest font-bold text-success">Most chosen</span>
                    )}
                  </button>
                );
              })}
            </div>
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              placeholder="Or enter custom amount"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
          </fieldset>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Make this a monthly gift</span>
          </label>

          <fieldset>
            <legend className="label">Direct my gift to</legend>
            <div className="grid grid-cols-2 gap-2">
              {DESIGNATIONS.map((d) => {
                const active = designation === d.id;
                return (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => setDesignation(d.id)}
                    className={`card-flat !p-3 text-start text-sm font-semibold ${active ? 'border-primary ring-2 ring-primary/30' : ''}`}
                  >
                    {active && <Check size={14} className="inline text-primary me-1" />}
                    {d.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">Pay with</legend>
            <div className="grid grid-cols-3 gap-2">
              <ProviderTile id="auto" current={provider} setProvider={setProvider} icon={ShieldCheck} label="Auto" sub="Best available" />
              <ProviderTile id="card" current={provider} setProvider={setProvider} icon={CreditCard} label="Card" sub="Stripe" />
              <ProviderTile id="mpesa" current={provider} setProvider={setProvider} icon={Smartphone} label="M-Pesa" sub="Daraja STK" />
            </div>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="label">Your name (optional)</span>
              <input className="input" value={donorName} onChange={(e) => setDonorName(e.target.value)} maxLength={120} />
            </label>
            <label className="block">
              <span className="label flex items-center gap-1"><Mail size={12} /> Email (optional)</span>
              <input className="input" type="email" value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} />
            </label>
          </div>
          {provider === 'mpesa' && (
            <label className="block">
              <span className="label flex items-center gap-1"><Phone size={12} /> M-Pesa phone (required)</span>
              <input className="input" type="tel" value={donorPhone} onChange={(e) => setDonorPhone(e.target.value)} placeholder="+2547XXXXXXXX" required />
            </label>
          )}

          <button
            type="submit"
            disabled={checkout.isPending}
            className="btn-primary w-full !py-3 text-lg inline-flex items-center justify-center gap-2"
          >
            {checkout.isPending && <Loader2 size={18} className="animate-spin" />}
            Continue to secure checkout
          </button>
          <p className="text-xs text-neutral-500 dark:text-slate-400 text-center">
            Payments are processed by our partners. AfyaConnect never stores card details.
          </p>
        </form>

        <aside className="space-y-4 lg:col-span-2">
          <Sidebar />
          <NewsletterBox
            email={newsletterEmail}
            setEmail={setNewsletterEmail}
            status={newsletterStatus}
            pending={newsletter.isPending}
            onSubmit={() => newsletter.mutate()}
          />
        </aside>
      </section>
    </main>
  );
}

function ProviderTile({ id, current, setProvider, icon: Icon, label, sub }) {
  const active = current === id;
  return (
    <button
      type="button"
      onClick={() => setProvider(id)}
      className={`card-flat !p-3 text-center text-xs font-semibold ${active ? 'border-primary ring-2 ring-primary/30' : ''}`}
    >
      <Icon size={20} className="mx-auto text-primary mb-1" />
      <div className="text-sm">{label}</div>
      <div className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-slate-400">{sub}</div>
    </button>
  );
}

function Hero() {
  return (
    <section className="bg-gradient-to-br from-success via-primary-600 to-primary text-white">
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-16 text-center">
        <HeartHandshake size={36} className="mx-auto mb-3 opacity-90" />
        <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-3">
          Power healthcare for refugees.
        </h1>
        <p className="text-white/90 text-lg max-w-2xl mx-auto">
          Your gift funds appointments, multilingual education, and 24/7 emergency response across our partner clinics.
        </p>
      </div>
    </section>
  );
}

function Sidebar() {
  return (
    <div className="card-flat !p-5 space-y-3">
      <h3 className="font-bold text-neutral-900 dark:text-white">Where every dollar goes</h3>
      <ul className="text-sm space-y-2 text-neutral-700 dark:text-slate-300">
        <li className="flex gap-2"><Check size={16} className="text-success shrink-0 mt-0.5" />Direct clinic supplies and consultations</li>
        <li className="flex gap-2"><Check size={16} className="text-success shrink-0 mt-0.5" />Multilingual content (English, Swahili, French, Arabic)</li>
        <li className="flex gap-2"><Check size={16} className="text-success shrink-0 mt-0.5" />SOS infrastructure & responder training</li>
        <li className="flex gap-2"><Check size={16} className="text-success shrink-0 mt-0.5" />Audited monthly transparency report</li>
      </ul>
      <Link to="/impact" className="btn-outline w-full text-sm">View live impact data</Link>
    </div>
  );
}

function NewsletterBox({ email, setEmail, status, pending, onSubmit }) {
  return (
    <div className="card-flat !p-5">
      <h3 className="font-bold text-neutral-900 dark:text-white mb-1">Get our monthly impact report</h3>
      <p className="text-xs text-neutral-500 dark:text-slate-400 mb-3">
        One email a month. Unsubscribe any time.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => { e.preventDefault(); if (email) onSubmit(); }}
      >
        <input
          className="input flex-1"
          type="email"
          required
          placeholder="you@example.org"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={pending} className="btn-primary !py-2 !px-4 text-sm">
          {pending ? '…' : 'Sign up'}
        </button>
      </form>
      {status === 'ok' && (
        <p className="text-xs text-success mt-2">Thanks! Please confirm via the link we just sent.</p>
      )}
      {status === 'err' && (
        <p className="text-xs text-danger mt-2">Could not subscribe. Please try again.</p>
      )}
    </div>
  );
}
