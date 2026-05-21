import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../api/client.js';

const FALLBACK_TESTIMONIALS = [
  {
    quote: 'When my daughter had a high fever at night, I used the SOS button and a clinician called me back in minutes. AfyaConnect did not just save us a trip \u2014 it gave us peace of mind.',
    name: 'Kevin O.',
    location: 'Patient, Kakuma 2',
  },
  {
    quote: 'Before AfyaConnect we waited the whole day. Now I check the queue from my phone and only walk to the clinic when my number is close.',
    name: 'Achol D.',
    location: 'Mother of three, Kakuma 1',
  },
  {
    quote: 'Health alerts in Kiswahili and Arabic mean my whole community gets the message \u2014 not just those who read English.',
    name: 'Dr. Mohamed A.',
    location: 'Clinical officer, Kalobeyei',
  },
  {
    quote: 'I used to walk 8 km to ask if the doctor was in. Now I just open AfyaConnect and book a ticket.',
    name: 'Peter K.',
    location: 'Community health volunteer',
  },
  {
    quote: 'I am living with diabetes. The reminders for my refills and check-ups have kept me consistent for the first time in years.',
    name: 'Amina H.',
    location: 'Patient, Kalobeyei Village 3',
  },
  {
    quote: 'As a new mother, the maternal health lessons in my own language helped me know what is normal and when to come in. I feel less alone.',
    name: 'Grace W.',
    location: 'Patient, Kakuma 4',
  },
  {
    quote: 'I was too shy to ask about my symptoms in person. The teleconsult let me speak to a doctor privately, and I finally got the treatment I needed.',
    name: 'Joseph M.',
    location: 'Patient, Kakuma 3',
  },
];

const FEATURES = [
  { icon: '📅', titleKey: 'landing.features.queue.t', bodyKey: 'landing.features.queue.b' },
  { icon: '📍', titleKey: 'landing.features.clinics.t', bodyKey: 'landing.features.clinics.b' },
  { icon: '🚨', titleKey: 'landing.features.sos.t', bodyKey: 'landing.features.sos.b' },
  { icon: '📚', titleKey: 'landing.features.edu.t', bodyKey: 'landing.features.edu.b' },
  { icon: '🌍', titleKey: 'landing.features.lang.t', bodyKey: 'landing.features.lang.b' },
  { icon: '🔒', titleKey: 'landing.features.secure.t', bodyKey: 'landing.features.secure.b' },
];

export default function Landing() {
  useDocumentTitle();
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary via-primary-600 to-primary-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-block bg-white/15 backdrop-blur px-3 py-1 rounded-pill text-xs font-semibold mb-4">
              {t('landing.badge')}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-5">
              {t('landing.headline')}
            </h1>
            <p className="text-lg text-white/90 mb-7 max-w-xl">
              {t('landing.subhead')}
            </p>
            <div className="flex flex-wrap gap-3">
              {user ? (
                <Link to="/app" className="btn bg-white text-primary hover:bg-neutral-50 text-lg !py-3 !px-6">
                  {t('landing.openDashboard')}
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn bg-white text-primary hover:bg-neutral-50 text-lg !py-3 !px-6">
                    {t('site.getStarted')} →
                  </Link>
                  <Link to="/login" className="btn border-2 border-white/60 text-white hover:bg-white/10 text-lg !py-3 !px-6">
                    {t('auth.login')}
                  </Link>
                </>
              )}
              <Link to="/clinics" className="btn text-white hover:bg-white/10 text-lg !py-3 !px-6">
                📍 {t('landing.browseClinics')}
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-6 max-w-md">
              <Stat n="21+" label={t('landing.stats.clinics')} />
              <Stat n="4" label={t('landing.stats.langs')} />
              <Stat n="24/7" label={t('landing.stats.support')} />
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="relative">
              <div className="absolute inset-0 bg-white/10 rounded-card blur-2xl" />
              <div className="relative bg-white rounded-card shadow-card p-6 text-neutral-900">
                <div className="text-xs uppercase tracking-wide text-neutral-900/60 mb-2">
                  {t('queue.title')}
                </div>
                <div className="text-7xl font-extrabold text-primary text-center my-4">#12</div>
                <div className="text-center text-sm text-neutral-900/70 mb-3">
                  {t('queue.nowServing', { n: 9 })} · {t('queue.ahead', { n: 3 })}
                </div>
                <div className="w-full bg-neutral-50 rounded-pill h-3 overflow-hidden mb-3">
                  <div className="bg-success h-3" style={{ width: '75%' }} />
                </div>
                <div className="text-center text-sm font-semibold text-success">
                  {t('home.estimatedWait', { minutes: 24 })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-neutral-900 mb-3">
            {t('landing.featuresTitle')}
          </h2>
          <p className="text-neutral-900/70 max-w-2xl mx-auto">
            {t('landing.featuresSub')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.titleKey} className="card !border-l-primary">
              <div className="text-4xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-lg mb-2 text-neutral-900">{t(f.titleKey)}</h3>
              <p className="text-sm text-neutral-900/70">{t(f.bodyKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-white border-y border-neutral-50">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-12">
            {t('landing.howTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {['register', 'book', 'visit'].map((k, i) => (
              <div key={k} className="text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-primary text-white text-xl font-extrabold flex items-center justify-center mb-4 shadow-card">
                  {i + 1}
                </div>
                <h3 className="font-bold text-lg mb-2">{t(`landing.steps.${k}.t`)}</h3>
                <p className="text-sm text-neutral-900/70">{t(`landing.steps.${k}.b`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialsSection />

      {/* CTA */}
      {!user && (
        <section className="max-w-4xl mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">{t('landing.ctaTitle')}</h2>
          <p className="text-neutral-900/70 mb-7">{t('landing.ctaBody')}</p>
          <Link to="/register" className="btn-primary text-lg !py-3 !px-8 inline-flex">
            {t('site.getStarted')} →
          </Link>
        </section>
      )}
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div>
      <div className="text-2xl font-extrabold">{n}</div>
      <div className="text-xs text-white/70">{label}</div>
    </div>
  );
}

function TestimonialsSection() {
  // Fetch approved testimonials from the API. If the call errors or returns
  // zero rows we fall back to the curated set so the section is never empty
  // (important when the platform is brand-new in a region).
  const { data } = useQuery({
    queryKey: ['public-testimonials'],
    queryFn: () => api.get('/testimonials?limit=6').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const live = data?.testimonials || [];
  const items = live.length
    ? live.slice(0, 3).map((t) => ({
        quote: t.quote,
        name: t.name,
        location: [t.role, t.location].filter(Boolean).join(' — '),
      }))
    : FALLBACK_TESTIMONIALS;

  return (
    <section className="bg-neutral-50 dark:bg-[#0b1220]">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-3 text-neutral-900 dark:text-white">
          Voices from the camp
        </h2>
        <p className="text-center text-neutral-700 dark:text-slate-300 mb-10 max-w-2xl mx-auto">
          How AfyaConnect is changing the way refugees and clinicians work together.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((c, i) => (
            <div key={c.name + i} className="card">
              <div className="text-4xl text-primary dark:text-accent leading-none mb-2">“</div>
              <p className="text-neutral-800 dark:text-slate-200 italic mb-4">{c.quote}</p>
              <div className="text-sm font-semibold text-neutral-900 dark:text-white">{c.name}</div>
              <div className="text-xs text-neutral-600 dark:text-slate-400">{c.location}</div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link to="/share-your-story" className="btn-outline inline-flex items-center gap-2">
            Share your story →
          </Link>
        </div>
        <div className="mt-3 text-center">
          <Link to="/onboard-clinic" className="text-sm text-primary font-semibold hover:underline">
            Run a clinic? List it on AfyaConnect →
          </Link>
        </div>
        <div className="mt-10 text-center text-xs uppercase tracking-wide text-neutral-500 dark:text-slate-400">
          Trusted by health partners working in Kakuma & Kalobeyei
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {['UNHCR', 'IRC', 'MSF', 'Kenya Red Cross', 'WHO', 'UNICEF'].map((p) => (
            <span key={p} className="chip-primary">{p}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
