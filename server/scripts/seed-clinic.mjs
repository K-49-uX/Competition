#!/usr/bin/env node
// Phase 3.3 — Clinic onboarding CLI.
//
// Spins up a brand-new clinic + its first clinic_admin in one command. Used
// when partnering with a new NGO so the admin team can hand the clinic_admin
// a working login on day 1 without the eng team needing to be involved.
//
// Usage:
//   node server/scripts/seed-clinic.mjs \
//        --name "Hope Clinic" \
//        --address "Block 7, Refugee Camp" \
//        --hours "08:00 - 17:00" \
//        --lng 34.87 --lat 3.72 \
//        --admin-name "Dr Asha" \
//        --admin-phone "+254700111222" \
//        --admin-password "ChangeMe123"
//
// All flags can also be supplied as env vars (uppercase, dashes -> underscores).
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

import { config } from '../src/config.js';
import { Clinic } from '../src/models/Clinic.js';
import { User } from '../src/models/User.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function envFallback(key) {
  return process.env[key.toUpperCase().replace(/-/g, '_')];
}

function need(args, key, label = key) {
  const v = args[key] ?? envFallback(key);
  if (v === undefined || v === '' || v === true) {
    console.error(`[seed-clinic] missing required --${key} (${label})`);
    process.exit(2);
  }
  return v;
}

async function main() {
  const args = parseArgs(process.argv);
  const name = need(args, 'name');
  const address = args.address ?? envFallback('address') ?? '';
  const hours = args.hours ?? envFallback('hours') ?? '08:00 - 17:00';
  const lng = Number(need(args, 'lng', 'longitude'));
  const lat = Number(need(args, 'lat', 'latitude'));
  if (Number.isNaN(lng) || Number.isNaN(lat)) {
    console.error('[seed-clinic] --lng and --lat must be numeric');
    process.exit(2);
  }
  const adminName = need(args, 'admin-name');
  const adminPhone = args['admin-phone'] ?? envFallback('admin-phone');
  const adminEmail = args['admin-email'] ?? envFallback('admin-email');
  const adminPassword = need(args, 'admin-password');
  if (!adminPhone && !adminEmail) {
    console.error('[seed-clinic] need --admin-phone or --admin-email');
    process.exit(2);
  }
  if (String(adminPassword).length < 8) {
    console.error('[seed-clinic] --admin-password must be at least 8 chars');
    process.exit(2);
  }

  await mongoose.connect(config.mongoUri);
  try {
    const existing = await Clinic.findOne({ name });
    if (existing) {
      console.error(`[seed-clinic] clinic "${name}" already exists (id=${existing._id})`);
      process.exit(3);
    }
    const clinic = await Clinic.create({
      name,
      address,
      hours,
      services: [],
      location: { type: 'Point', coordinates: [lng, lat] },
    });

    const dupQ = adminPhone ? { phone: adminPhone } : { email: adminEmail };
    if (await User.findOne(dupQ)) {
      console.error('[seed-clinic] admin phone/email already in use');
      await Clinic.deleteOne({ _id: clinic._id });
      process.exit(3);
    }
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const admin = await User.create({
      name: adminName,
      phone: adminPhone || undefined,
      email: adminEmail || undefined,
      passwordHash,
      role: 'clinic_admin',
      clinicId: clinic._id,
    });

    console.log(`[seed-clinic] OK`);
    console.log(`  clinic: ${clinic.name} (id=${clinic._id})`);
    console.log(`  admin:  ${admin.name} (${adminPhone || adminEmail}) role=clinic_admin`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error('[seed-clinic] failed:', err);
  process.exit(1);
});
