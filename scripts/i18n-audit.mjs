// Phase 6.1 — i18n parity audit.
//
// Compares non-English locale files against `en.json` (the source of truth)
// and prints any missing keys per locale, plus any extra keys that don't
// exist in English (typos / orphans). Exits non-zero if any locale is
// missing keys, so we can wire it into CI later.
//
// Usage: node scripts/i18n-audit.mjs [--write]
//   --write fills missing keys in target locales with the English string
//           wrapped in `[NEEDS:xx] ...` so translators can spot them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.resolve(__dirname, '..', 'client', 'src', 'locales');
const SOURCE = 'en';
const TARGETS = ['sw', 'fr', 'ar'];

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${name}.json`), 'utf8'));
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else out[key] = v;
  }
  return out;
}

function setDeep(obj, dotted, value) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts.at(-1)] = value;
}

const write = process.argv.includes('--write');
const en = load(SOURCE);
const flatEn = flatten(en);
const enKeys = new Set(Object.keys(flatEn));

let totalMissing = 0;
console.log(`English keys: ${enKeys.size}\n`);

for (const lang of TARGETS) {
  const data = load(lang);
  const flat = flatten(data);
  const have = new Set(Object.keys(flat));
  const missing = [...enKeys].filter((k) => !have.has(k));
  const extras = [...have].filter((k) => !enKeys.has(k));

  console.log(`=== ${lang} ===`);
  console.log(`  have:    ${have.size}`);
  console.log(`  missing: ${missing.length}`);
  console.log(`  extras:  ${extras.length}`);
  if (missing.length > 0) {
    console.log('  --- missing keys:');
    for (const k of missing.slice(0, 30)) console.log(`    - ${k}`);
    if (missing.length > 30) console.log(`    … and ${missing.length - 30} more`);
  }
  if (extras.length > 0) {
    console.log('  --- extra keys (not in English):');
    for (const k of extras.slice(0, 10)) console.log(`    - ${k}`);
  }
  console.log('');

  totalMissing += missing.length;

  if (write && missing.length > 0) {
    for (const k of missing) setDeep(data, k, `[NEEDS:${lang}] ${flatEn[k]}`);
    fs.writeFileSync(
      path.join(LOCALES_DIR, `${lang}.json`),
      JSON.stringify(data, null, 2) + '\n'
    );
    console.log(`  -> wrote ${missing.length} placeholder(s) into ${lang}.json\n`);
  }
}

if (totalMissing > 0 && !write) {
  console.log(`FAIL: ${totalMissing} missing key(s) across locales. Run with --write to fill placeholders.`);
  process.exit(1);
}
console.log('All locales in sync ✓');
