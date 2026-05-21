import { useTranslation } from 'react-i18next';
import {
  HeartPulse,
  Target,
  Eye,
  Shield,
  Users,
  Globe2,
  Sparkles,
  Stethoscope,
  HandHeart,
  GraduationCap,
  Languages,
  Lock,
} from 'lucide-react';

function SectionCard({ icon: Icon, title, color = 'primary', children }) {
  const tones = {
    primary: 'bg-primary-50 text-primary dark:bg-primary-900/30 dark:text-primary-200',
    accent:  'bg-accent-50  text-accent-700 dark:bg-accent-700/30 dark:text-accent-100',
    care:    'bg-care-50    text-care-600 dark:bg-care-600/20 dark:text-care-100',
    success: 'bg-success-50 text-success-600 dark:bg-success/20 dark:text-success-50',
    warning: 'bg-warning-50 text-warning-600 dark:bg-warning/20 dark:text-warning-50',
  };
  return (
    <div className="card text-start">
      <div className={`inline-grid place-items-center w-12 h-12 rounded-xl mb-3 ${tones[color]}`}>
        <Icon size={22} strokeWidth={2.2} />
      </div>
      <h3 className="font-bold text-lg text-neutral-900 dark:text-white mb-2">{title}</h3>
      <div className="text-sm leading-relaxed text-neutral-700 dark:text-slate-300 space-y-2">
        {children}
      </div>
    </div>
  );
}

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="bg-neutral-50 dark:bg-[#0b1220] min-h-full">
      {/* Hero */}
      <section
        className="hero-gradient"
        style={{ color: '#ffffff', backgroundColor: '#0056b3' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-24">
          <div
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-pill px-4 py-1.5 text-sm font-semibold mb-4"
            style={{ color: '#ffffff' }}
          >
            <HeartPulse size={16} />
            <span>{t('site.about')} AfyaConnect</span>
          </div>
          <h1
            className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight"
            style={{ color: '#ffffff' }}
          >
            Healthcare that follows you — wherever life takes you.
          </h1>
          <p
            className="mt-4 text-lg md:text-xl max-w-3xl"
            style={{ color: 'rgba(255,255,255,0.95)' }}
          >
            AfyaConnect is a humanitarian-tech platform built for the Kakuma Refugee Camp,
            Kalobeyei Settlement and the wider Turkana host community. We exist so that
            no person — regardless of language, status or location — has to choose
            between waiting hours in line and getting the care they need.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 py-12 md:py-16 space-y-12">
        {/* Story */}
        <section>
          <h2 className="section-title">Our story</h2>
          <p className="section-sub max-w-3xl">From a long line in the dust to a digital ticket in your pocket.</p>
          <div className="mt-5 prose-style space-y-4 text-neutral-700 dark:text-slate-300 leading-relaxed">
            <p>
              AfyaConnect started as a conversation between a community health worker in Kakuma 1
              and a young software engineer who had grown up in the camp. Mothers were carrying
              sick children for hours under the sun, only to wait another four to five hours
              outside an overcrowded clinic. Pregnant women were missing antenatal visits because
              they couldn’t afford to lose a whole day. Information about new vaccination drives
              spread by word of mouth, and often arrived too late.
            </p>
            <p>
              We asked a simple question: what if a phone — even a basic one — could tell you
              when it’s your turn, where to go, and what to do in your own language? That
              question became AfyaConnect. Today we work hand-in-hand with IRC, UNHCR, AMREF,
              IOM, KRCS, the Ministry of Health and dozens of community health volunteers to
              make care faster, fairer and more dignified for everyone in the camp.
            </p>
          </div>
        </section>

        {/* Mission / Vision / Values */}
        <section>
          <h2 className="section-title">What drives us</h2>
          <p className="section-sub">Three commitments at the heart of everything we build.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
            <SectionCard icon={Target} title="Our mission" color="primary">
              <p>
                To put trusted, multilingual healthcare in the pocket of every refugee, asylum
                seeker and host-community member in Kakuma and Kalobeyei.
              </p>
              <p>
                We do this by digitising the patient queue, mapping every clinic and pharmacy,
                broadcasting public-health alerts in real time, and translating evidence-based
                health information from WHO, UNHCR, UNICEF, CDC and MSF into Swahili, French
                and Arabic.
              </p>
            </SectionCard>

            <SectionCard icon={Eye} title="Our vision" color="accent">
              <p>
                A world where displacement does not mean disconnection from healthcare. Where a
                grandmother in Kakuma 4, a newborn in Kalobeyei Village 3 and a clinician at
                Amusait Hospital all share the same standard of care, the same information, and
                the same dignity.
              </p>
              <p>
                We see a future where every clinic in East Africa runs on AfyaConnect — and
                where humanitarian healthcare is measured not in queues, but in lives changed.
              </p>
            </SectionCard>

            <SectionCard icon={HandHeart} title="Our values" color="care">
              <ul className="list-disc ms-5 space-y-1">
                <li><span className="font-semibold">Dignity first</span> — every patient is treated as a person, not a number.</li>
                <li><span className="font-semibold">Inclusion</span> — built for low-bandwidth phones, four languages, and right-to-left scripts.</li>
                <li><span className="font-semibold">Privacy</span> — accounts are encrypted, passwords hashed, records private.</li>
                <li><span className="font-semibold">Transparency</span> — open data partnerships with UNHCR and WHO.</li>
                <li><span className="font-semibold">Community</span> — co-designed with refugees, for refugees.</li>
              </ul>
            </SectionCard>
          </div>
        </section>

        {/* What we do */}
        <section>
          <h2 className="section-title">What we do</h2>
          <p className="section-sub">Six tools, one app — designed to remove the friction from getting care.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
            <SectionCard icon={Stethoscope} title="Live queue tickets" color="primary">
              <p>
                Skip the line. Get a digital ticket from your phone, watch your position update
                in real time, and only walk to the clinic when it’s nearly your turn.
              </p>
            </SectionCard>
            <SectionCard icon={Globe2} title="Clinic & pharmacy locator" color="accent">
              <p>
                21+ facilities mapped — Amusait Hospital, Nalemsekon, Locher Angamor, Kalobeyei
                Main and more — with services, hours and one-tap directions.
              </p>
            </SectionCard>
            <SectionCard icon={Shield} title="Emergency SOS" color="warning">
              <p>
                One tap alerts community health workers and clinic staff with your name,
                phone and last known location for the fastest possible response.
              </p>
            </SectionCard>
            <SectionCard icon={GraduationCap} title="Health education" color="care">
              <p>
                21+ topics — hygiene, nutrition, maternal health, mental health, TB, HIV,
                cholera, NCDs and more — sourced from WHO, UNHCR, UNICEF, CDC and MSF.
              </p>
            </SectionCard>
            <SectionCard icon={Languages} title="Multilingual & RTL" color="primary">
              <p>
                English, Kiswahili, French and Arabic. Right-to-left layout for Arabic,
                large-tap targets for low-literacy users, and works on basic smartphones.
              </p>
            </SectionCard>
            <SectionCard icon={Lock} title="Privacy by design" color="success">
              <p>
                Passwords are hashed with bcrypt, sessions use signed JWTs, reset tokens
                expire in one hour, and patient records are never shared without consent.
              </p>
            </SectionCard>
          </div>
        </section>

        {/* Impact stats */}
        <section className="card-flat">
          <h2 className="section-title">Our reach today</h2>
          <p className="section-sub">As of {new Date().getFullYear()}, working across Kakuma & Kalobeyei.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 text-center">
            <div>
              <div className="text-4xl font-extrabold text-primary dark:text-accent">21+</div>
              <div className="text-sm text-neutral-600 dark:text-slate-400 mt-1">Health facilities mapped</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-primary dark:text-accent">21</div>
              <div className="text-sm text-neutral-600 dark:text-slate-400 mt-1">Education topics</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-primary dark:text-accent">4</div>
              <div className="text-sm text-neutral-600 dark:text-slate-400 mt-1">Languages supported</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-primary dark:text-accent">24/7</div>
              <div className="text-sm text-neutral-600 dark:text-slate-400 mt-1">SOS availability</div>
            </div>
          </div>
        </section>

        {/* Partners */}
        <section>
          <h2 className="section-title">Who we work with</h2>
          <p className="section-sub">Care is a team sport. We are proud to partner with:</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              'UNHCR', 'WHO', 'UNICEF', 'IRC', 'AMREF', 'IOM',
              'KRCS', 'MSF', 'JRS', 'IFRC', 'Ministry of Health (Kenya)',
              'Turkana County Government', 'Heshima Kenya', 'CDC',
            ].map((org) => (
              <span key={org} className="chip-primary">{org}</span>
            ))}
          </div>
        </section>

        {/* Team / Outro */}
        <section className="card">
          <div className="flex items-start gap-4">
            <div className="hidden sm:grid place-items-center w-12 h-12 rounded-xl bg-care-50 text-care-600 dark:bg-care-600/20 dark:text-care-100">
              <Users size={22} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-neutral-900 dark:text-white">Built by the community, for the community</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-700 dark:text-slate-300">
                Our small team of refugee engineers, nurses, community health volunteers and
                designers meets every week in Kakuma 1 to test new features with real
                patients. If you’d like to volunteer, contribute translations, or partner
                with us — please reach out at{' '}
                <a className="text-primary dark:text-accent underline font-semibold" href="mailto:help@afyaconnect.org">help@afyaconnect.org</a>.
              </p>
              <p className="mt-3 text-sm text-neutral-700 dark:text-slate-300 italic flex items-center gap-2">
                <Sparkles size={14} className="text-warning" />
                <span>“Afya” means health in Kiswahili. We are here so that everyone, everywhere, can connect to it.</span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
