// One-shot script: remove smoke-test testimonial rows and seed meaningful
// patient stories. Run with:  node server/scripts/seed-testimonials.mjs
import 'dotenv/config';
import mongoose from 'mongoose';
import { Testimonial } from '../src/models/Testimonial.js';

const CONSENT_TEXT =
  'I confirm that the story above is mine to share, and I give AfyaConnect permission to publish it on their website, social media, donor materials, and reports. I understand I can ask for it to be removed at any time by emailing privacy@afyaconnect.org.';

const STORIES = [
  {
    name: 'Kevin O.',
    role: 'patient',
    location: 'Kakuma 2',
    quote:
      'When my daughter had a high fever at night, I used the SOS button and a clinician called me back within minutes. AfyaConnect did not just save us a long walk in the dark — it gave us peace of mind.',
    featured: true,
  },
  {
    name: 'Achol D.',
    role: 'patient',
    location: 'Kakuma 1',
    quote:
      'Before AfyaConnect we waited the whole day with three children at the clinic. Now I check the queue from my phone and only walk over when my number is close. My day is mine again.',
    featured: true,
  },
  {
    name: 'Amina H.',
    role: 'patient',
    location: 'Kalobeyei Village 3',
    quote:
      'I am living with diabetes. The reminders for my refills and check-ups have kept me consistent for the first time in years. I no longer feel forgotten between visits.',
    featured: true,
  },
  {
    name: 'Grace W.',
    role: 'patient',
    location: 'Kakuma 4',
    quote:
      'As a new mother, the maternal-health lessons in my own language helped me know what is normal and when to come in. I feel less alone, and my baby is healthy.',
    featured: false,
  },
  {
    name: 'Joseph M.',
    role: 'patient',
    location: 'Kakuma 3',
    quote:
      'I was too shy to ask about my symptoms in person. The teleconsult let me speak to a doctor privately, and I finally got the treatment I needed. This app removed the shame.',
    featured: false,
  },
  {
    name: 'Dr. Mohamed A.',
    role: 'clinician',
    location: 'Kalobeyei',
    quote:
      'Health alerts in Kiswahili and Arabic mean my whole community gets the message — not just those who read English. Outbreak response is finally a two-way conversation.',
    featured: false,
  },
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri);
  console.log('[seed-testimonials] connected');

  // 1. Remove auto-generated smoke-test rows
  const del = await Testimonial.deleteMany({ name: /smoke tester/i });
  console.log(`[seed-testimonials] removed ${del.deletedCount} smoke-test rows`);

  // 2. Upsert meaningful stories (idempotent on name+location)
  const now = new Date();
  let inserted = 0;
  let updated = 0;
  for (const s of STORIES) {
    const existing = await Testimonial.findOne({ name: s.name, location: s.location });
    if (existing) {
      existing.quote = s.quote;
      existing.role = s.role;
      existing.status = 'approved';
      existing.featured = s.featured;
      existing.moderatedAt = now;
      await existing.save();
      updated += 1;
    } else {
      await Testimonial.create({
        ...s,
        language: 'en',
        consentGivenAt: now,
        consentText: CONSENT_TEXT,
        status: 'approved',
        moderatedAt: now,
        featured: s.featured,
      });
      inserted += 1;
    }
  }

  console.log(`[seed-testimonials] inserted=${inserted} updated=${updated}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[seed-testimonials] failed:', err);
  process.exit(1);
});
