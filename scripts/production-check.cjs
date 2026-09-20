#!/usr/bin/env node
/**
 * Production structural check — no secrets printed.
 * Verifies build artifacts and that production env keys exist (not values).
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const failures = [];

function mustExist(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    failures.push(`Missing required path: ${rel}`);
  }
}

mustExist('apps/web/.next');
mustExist('apps/api/dist/main.js');
mustExist('apps/worker/dist/main.js');
mustExist('ecosystem.config.cjs');
mustExist('deploy/nginx/aviationsminute.conf');
mustExist('.env.production.example');

const envPath = path.join(root, '.env');
if (!fs.existsSync(envPath)) {
  failures.push('Missing .env (copy from .env.production.example on the VPS)');
} else {
  const raw = fs.readFileSync(envPath, 'utf8');
  const keys = new Set(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => line.split('=')[0]?.trim())
      .filter(Boolean),
  );

  const required = [
    'NODE_ENV',
    'DATABASE_URL',
    'REDIS_URL',
    'WEB_ORIGIN',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'SOCIAL_TOKEN_ENCRYPTION_KEY',
    'SESSION_SECRET',
    'NEXT_PUBLIC_API_URL',
  ];

  for (const key of required) {
    if (!keys.has(key)) {
      failures.push(`Missing env key in .env: ${key}`);
    }
  }

  if (keys.has('NODE_ENV') && !/^NODE_ENV=production\s*$/m.test(raw)) {
    // soft warning only when running deploy.sh which already enforces production
  }
}

if (failures.length > 0) {
  console.error('[production-check] FAILED');
  for (const item of failures) {
    console.error(` - ${item}`);
  }
  process.exit(1);
}

console.log(
  JSON.stringify({
    status: 'ok',
    checked: ['web .next', 'api dist', 'worker dist', 'ecosystem', 'nginx template', '.env keys'],
  }),
);
