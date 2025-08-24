// Simple spec verifier for our North Star + architecture
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const requiredPaths = [
  'apps/web',
  'packages/shared',
  'supabase/functions',
  'supabase/migrations',
  '.cursor/environment.json',   // background agent guardrails
  '.cursor/rules'               // persistent rules / acceptance checks
];

const requiredFunctions = [
  'session-create',
  'session-join',
  'session-state',
  'order-submit',
  'host-shock',
  'export-csv'
];

const checks = [];

function ok(msg){ checks.push(['PASS', msg]); }
function bad(msg){ checks.push(['FAIL', msg]); }

for (const p of requiredPaths) {
  existsSync(p) ? ok(`exists: ${p}`) : bad(`missing: ${p}`);
}

// Next.js must export static pages (GitHub Pages)
try {
  const nextCfg = readFileSync('apps/web/next.config.js','utf8');
  /output\s*:\s*['"]export['"]/.test(nextCfg)
    ? ok('Next.js output:"export" is set (SSG for GitHub Pages)')
    : bad('Next.js next.config.js is missing output:"export"');
} catch {
  bad('apps/web/next.config.js not found');
}

// Shared lib must export quant + risk APIs
try {
  const idx = readFileSync('packages/shared/src/index.ts','utf8');
  const sigs = ['priceBlack76', 'greeks', 'aggregateGreeks', 'estimateVar', 'computeScore'];
  sigs.every(s => idx.includes(s))
    ? ok('shared/index.ts exports price/greeks/var/score')
    : bad('shared/index.ts missing one of price/greeks/var/score exports');
} catch {
  bad('packages/shared/src/index.ts not found');
}

// Supabase Edge Functions
try {
  const fnDir = 'supabase/functions';
  const dirs = existsSync(fnDir) ? readdirSync(fnDir, { withFileTypes: true }).filter(d=>d.isDirectory()).map(d=>d.name) : [];
  for (const f of requiredFunctions) {
    dirs.includes(f) ? ok(`edge function present: ${f}`) : bad(`edge function missing: ${f}`);
  }
} catch {
  bad('Cannot read supabase/functions');
}

// Basic tests present?
existsSync('packages/shared/test')
  ? ok('unit tests folder present: packages/shared/test')
  : bad('unit tests folder missing: packages/shared/test');

// README must have Admin Quick Start
try {
  const readme = readFileSync('README.md','utf8');
  /Admin Quick Start/i.test(readme)
    ? ok('README has Admin Quick Start')
    : bad('README missing Admin Quick Start section');
} catch {
  bad('README.md not found');
}

// Print result
const pad = 6;
let fails = 0;
for (const [s,m] of checks) {
  if (s === 'FAIL') fails++;
  console.log(`${s.padEnd(pad)} ${m}`);
}
if (fails) {
  console.error(`\n❌ ${fails} failure(s). See messages above.`);
  process.exit(1);
} else {
  console.log(`\n✅ All checks passed against the acceptance contract.`);
}
