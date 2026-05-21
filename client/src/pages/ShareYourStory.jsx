import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Mic, CheckCircle2, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '../api/client.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const CONSENT_TEXT =
  'I confirm that the story above is mine to share, and I give AfyaConnect permission to publish it on their website, social media, donor materials, and reports. I understand I can ask for it to be removed at any time by emailing privacy@afyaconnect.org.';

const ROLES = [
  { id: 'patient', label: 'Patient' },
  { id: 'family', label: 'Family member' },
  { id: 'clinician', label: 'Clinician / health worker' },
  { id: 'partner', label: 'Partner organisation' },
  { id: 'donor', label: 'Donor' },
  { id: 'other', label: 'Other' },
];

export default function ShareYourStory() {
  const { t, i18n } = useTranslation();
  useDocumentTitle(t('story.title') || 'Share your story');

  const [form, setForm] = useState({
    name: '',
    role: 'patient',
    location: '',
    quote: '',
    consent: false,
  });

  const submit = useMutation({
    mutationFn: () =>
      api.post('/testimonials', {
        name: form.name.trim(),
        role: form.role,
        location: form.location.trim() || undefined,
        language: ['en', 'sw', 'fr', 'ar'].includes(i18n.language) ? i18n.language : 'en',
        quote: form.quote.trim(),
        consent: true,
        consentText: CONSENT_TEXT,
      }).then((r) => r.data),
  });

  const onSubmit = (e) => {
    e.preventDefault();
    if (!form.consent) return;
    if (form.quote.trim().length < 30) return;
    submit.mutate();
  };

  return (
    <main id="main-content" className="bg-neutral-50">
      <section className="bg-gradient-to-br from-primary via-primary-600 to-primary-700 text-white">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <Mic size={32} className="mb-3 opacity-90" />
          <h1 className="text-3xl md:text-4xl font-extrabold">Share your story</h1>
          <p className="text-white/90 mt-2 max-w-xl">
            Your words help others find help and inspire donors to keep AfyaConnect open.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-10">
        {submit.isSuccess ? (
          <SuccessCard />
        ) : (
          <form onSubmit={onSubmit} className="card-flat !p-6 space-y-5">
            <p className="text-sm text-neutral-600 dark:text-slate-400">
              Stories are reviewed by our team before they appear on the site. We never publish anything without your explicit consent.
            </p>

            <label className="block">
              <span className="label">Your name (or first name only) *</span>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                minLength={2}
                maxLength={80}
                placeholder="e.g. Achol D."
              />
            </label>

            <label className="block">
              <span className="label">Your role *</span>
              <select
                className="input"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label">Where are you based? (optional)</span>
              <input
                className="input"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                maxLength={80}
                placeholder="e.g. Kakuma 1"
              />
            </label>

            <label className="block">
              <span className="label">Your story *</span>
              <textarea
                className="input min-h-[180px]"
                value={form.quote}
                onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
                required
                minLength={30}
                maxLength={1000}
                placeholder="Tell us how AfyaConnect made a difference for you or your community."
              />
              <div className="flex justify-between text-xs text-neutral-500 dark:text-slate-400 mt-1">
                <span>{form.quote.length < 30 ? `${30 - form.quote.length} more characters needed` : 'Looks good'}</span>
                <span>{form.quote.length} / 1000</span>
              </div>
            </label>

            <ConsentBox
              checked={form.consent}
              onChange={(v) => setForm((f) => ({ ...f, consent: v }))}
              text={CONSENT_TEXT}
            />

            {submit.isError && (
              <div className="text-sm text-danger flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                Something went wrong. Please try again or email privacy@afyaconnect.org.
              </div>
            )}

            <button
              type="submit"
              disabled={!form.consent || form.quote.trim().length < 30 || submit.isPending}
              className="btn-primary w-full !py-3 inline-flex items-center justify-center gap-2"
            >
              {submit.isPending && <Loader2 size={18} className="animate-spin" />}
              Submit my story
            </button>
            <p className="text-xs text-neutral-500 dark:text-slate-400 text-center">
              By submitting you acknowledge our <Link to="/privacy" className="underline">privacy policy</Link>.
            </p>
          </form>
        )}
      </section>
    </main>
  );
}

function ConsentBox({ checked, onChange, text }) {
  return (
    <label className={`block card-flat !p-4 cursor-pointer transition ${checked ? 'border-success ring-2 ring-success/30' : ''}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 w-4 h-4 shrink-0"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required
        />
        <div className="text-sm">
          <div className="flex items-center gap-1.5 font-bold text-neutral-900 dark:text-white mb-1">
            <ShieldCheck size={16} className="text-success" />
            Consent to publish
          </div>
          <p className="text-neutral-700 dark:text-slate-300 leading-relaxed">{text}</p>
        </div>
      </div>
    </label>
  );
}

function SuccessCard() {
  return (
    <div className="card-flat !p-8 text-center space-y-3">
      <CheckCircle2 size={48} className="mx-auto text-success" />
      <h2 className="text-2xl font-extrabold">Thank you for sharing.</h2>
      <p className="text-neutral-700 dark:text-slate-300">
        Our team will review your story shortly. Once approved, it may appear on our website, donor reports, and social media.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <Link to="/" className="btn-primary">Back to home</Link>
        <Link to="/impact" className="btn-outline">See our impact</Link>
      </div>
    </div>
  );
}
