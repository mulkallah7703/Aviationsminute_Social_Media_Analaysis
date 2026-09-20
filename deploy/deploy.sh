#!/usr/bin/env bash
# Safe production deploy for Aviationsminute Social Media
# Run from the repository root on the VPS.
# Stops on first failure. Does not restart PM2 unless the full build succeeds.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p logs

echo "==> [deploy] Working directory: $ROOT_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: .env is missing. Copy .env.production.example to .env and fill secrets." >&2
  exit 1
fi

# Export env for this shell (NEXT_PUBLIC_* must be present during next build)
set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ "${NODE_ENV:-}" != "production" ]]; then
  echo "ERROR: NODE_ENV must be production for deploy.sh" >&2
  exit 1
fi

echo "==> [deploy] Pulling latest code (if git remote configured)"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git pull --ff-only || {
    echo "WARN: git pull failed or not configured; continuing with local tree" >&2
  }
fi

echo "==> [deploy] Installing dependencies"
pnpm install --frozen-lockfile

echo "==> [deploy] Generating Prisma client (no migrate reset / no db push)"
pnpm db:generate

echo "==> [deploy] Building monorepo"
pnpm build

echo "==> [deploy] Production structural check"
node scripts/production-check.cjs

echo "==> [deploy] Reloading PM2 processes"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe sma-api >/dev/null 2>&1; then
    pm2 reload ecosystem.config.cjs --update-env
  else
    pm2 start ecosystem.config.cjs
  fi
  pm2 save
else
  echo "ERROR: pm2 is not installed. Install with: npm i -g pm2" >&2
  exit 1
fi

echo "==> [deploy] Waiting for API readiness"
sleep 3
if curl -fsS "http://127.0.0.1:5000/api/health/ready" >/dev/null; then
  echo "==> [deploy] Health ready: OK"
else
  echo "ERROR: /api/health/ready failed after reload" >&2
  pm2 status || true
  exit 1
fi

echo "==> [deploy] Process status"
pm2 status

echo "==> [deploy] Complete"
