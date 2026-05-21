import { Lock, Shield, Database, EyeOff, Mail, FileText } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

function Section({ icon: Icon, title, children }) {
  return (
    <section className="card text-start">
      <div className="flex items-center gap-3 mb-2">
        <div className="grid place-items-center w-10 h-10 rounded-lg bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent">
          <Icon size={20} />
        </div>
        <h2 className="font-bold text-lg text-neutral-900 dark:text-white">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed text-neutral-700 dark:text-slate-300 space-y-2">
        {children}
      </div>
    </section>
  );
}

export default function Privacy() {
  useDocumentTitle('Privacy & data handling');

  return (
    <div className="bg-neutral-50 dark:bg-[#0b1220] min-h-full">
      <section className="hero-gradient" style={{ color: '#fff', backgroundColor: '#0056b3' }}>
        <div className="max-w-4xl mx-auto px-4 py-14 md:py-20">
          <div
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-pill px-4 py-1.5 text-sm font-semibold mb-3"
            style={{ color: '#fff' }}
          >
            <Lock size={14} /> Privacy &amp; data handling
          </div>
          <h1
            className="text-4xl md:text-5xl font-extrabold leading-tight tracking-tight"
            style={{ color: '#fff' }}
          >
            Your information is yours.
          </h1>
          <p className="mt-3 text-lg max-w-3xl" style={{ color: 'rgba(255,255,255,0.95)' }}>
            AfyaConnect is built for refugee and host communities. We treat the trust you place in us
            as the most important thing on this platform.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 py-10 md:py-14 space-y-5">
        <Section icon={Database} title="What we collect">
          <p>
            <strong>Account holders:</strong> name, phone (or email), refugee ID if you provide it,
            preferred language, and an optional profile photo. Passwords are stored as a one-way
            hash — we cannot read them.
          </p>
          <p>
            <strong>Guest bookings:</strong> patient name, age, sex, contact phone, nationality
            and block/village (optional), the reason for the visit, and the helper&apos;s name and
            phone if someone else is booking on the patient&apos;s behalf.
          </p>
          <p>
            <strong>Usage data:</strong> the clinic you booked with, ticket numbers and
            appointment status. We do not collect device IDs or third-party tracking cookies.
          </p>
        </Section>

        <Section icon={Shield} title="How we use it">
          <ul className="list-disc ms-5 space-y-1">
            <li>To issue your ticket and tell the clinic you are coming.</li>
            <li>To show you live queue position and wait times.</li>
            <li>To send health announcements relevant to your camp or settlement.</li>
            <li>To improve safety (e.g. responding to SOS alerts).</li>
          </ul>
          <p>We never use your data for advertising.</p>
        </Section>

        <Section icon={EyeOff} title="Who can see it">
          <p>
            Only the clinic you book with sees your booking details. Authorised admins of
            AfyaConnect can see anonymised usage statistics for service planning. Your data is
            <strong> never</strong> shared with immigration, asylum or law-enforcement bodies.
          </p>
        </Section>

        <Section icon={Lock} title="How we protect it">
          <ul className="list-disc ms-5 space-y-1">
            <li>HTTPS in transit, encrypted MongoDB Atlas storage at rest.</li>
            <li>Passwords hashed with bcrypt; sessions use signed JWTs.</li>
            <li>Strict input validation and rate limiting against abuse.</li>
            <li>Role-based access — clinicians only see their clinic&apos;s queue.</li>
          </ul>
        </Section>

        <Section icon={FileText} title="Your rights">
          <ul className="list-disc ms-5 space-y-1">
            <li>You can edit your name, language and photo at any time on your profile.</li>
            <li>You can ask us to delete your account and bookings — see contact below.</li>
            <li>You can ask for a copy of all data we hold about you.</li>
          </ul>
        </Section>

        <Section icon={Mail} title="Contact">
          <p>
            Questions or requests? Email{' '}
            <a className="text-primary dark:text-accent underline" href="mailto:privacy@afyaconnect.org">
              privacy@afyaconnect.org
            </a>{' '}
            or visit the AfyaConnect helpdesk in Kakuma 1, Kakuma 3 or Kalobeyei Main.
          </p>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-3">
            Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </Section>
      </div>
    </div>
  );
}
