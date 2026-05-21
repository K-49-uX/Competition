// Resets (or creates) the admin user with a known phone + password.
// Run from the repo root:
//   node server/scripts/reset-admin.mjs
//
// Override defaults via env vars:
//   ADMIN_PHONE=+254700000000  ADMIN_PASSWORD=admin1234  node server/scripts/reset-admin.mjs

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';
import { User } from '../src/models/User.js';

const phone = process.env.ADMIN_PHONE || config.admin.phone || '+254700000000';
const password = process.env.ADMIN_PASSWORD || config.admin.password || 'admin1234';
const name = process.env.ADMIN_NAME || config.admin.name || 'Camp Admin';

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('[reset-admin] connected to mongo');

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ phone });

  if (existing) {
    existing.role = 'admin';
    existing.passwordHash = passwordHash;
    existing.name = existing.name || name;
    await existing.save();
    console.log(`[reset-admin] updated existing user (${phone}) — role=admin, password reset.`);
  } else {
    await User.create({
      phone,
      passwordHash,
      name,
      role: 'admin',
      language: 'en',
    });
    console.log(`[reset-admin] created new admin user (${phone}).`);
  }

  console.log('\nLogin with:');
  console.log(`  phone:    ${phone}`);
  console.log(`  password: ${password}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[reset-admin] FAILED:', err);
  process.exit(1);
});
