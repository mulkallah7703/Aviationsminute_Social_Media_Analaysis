# VPS Deployment Guide — Aviationsminute Social Media

This guide deploys the monorepo to a Linux VPS (Ubuntu 22.04/24.04 recommended) with:

- **Nginx** (public 80/443 only)
- **Next.js** web on `127.0.0.1:3000`
- **NestJS** API on `127.0.0.1:5000`
- **BullMQ worker** (no public port)
- **Redis** private on `127.0.0.1:6379` (Docker)
- **SQL Server** external / existing (`DigitalSocialMedia`) — never replaced or reset

## Architecture decision: PM2 + Docker Redis (not full Docker)

| Option | Verdict for this repo |
|--------|------------------------|
| **PM2** for web/api/worker | Chosen — simplest for pnpm/Turborepo + Prisma generate + external SQL Server |
| **Docker** for Redis only | Chosen — isolated Redis with localhost publish |
| Full Docker Compose for all apps | Not chosen — higher complexity for monorepo workspace builds, slower iteration, no benefit while SQL Server stays external |

```
Internet
   ↓
Nginx (80/443, TLS)
   ├── /        → Next.js  127.0.0.1:3000
   └── /api/    → NestJS   127.0.0.1:5000
                     ↓
              SQL Server (external DigitalSocialMedia)
                     ↓
              Redis 127.0.0.1:6379
                     ↓
              Worker (BullMQ)
                     ↓
              YouTube / future TikTok APIs
```

---

## 1. Recommended VPS specs

| Resource | Minimum | Comfortable |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB+ |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

---

## 2. OS packages

```bash
sudo apt update
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx
```

Install Docker (for Redis):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# log out/in after adding the docker group
```

---

## 3. Node.js and pnpm

Required by `package.json` engines: **Node.js >= 20.19.0**, **pnpm 10.28.1**.

```bash
# Node 20 via NodeSource or nvm — example with NodeSource:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo npm install -g pnpm@10.28.1 pm2
node -v
pnpm -v
pm2 -v
```

---

## 4. Clone the repository

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
git clone YOUR_GIT_REMOTE DigitalSocialMediaAviationsminute
cd DigitalSocialMediaAviationsminute
```

---

## 5. Redis (private)

```bash
# Create a strong password and keep it only in .env
export REDIS_PASSWORD='YOUR_REDIS_PASSWORD'
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

Confirm Redis is **not** reachable from the public Internet (only `127.0.0.1:6379`).

Persistence: AOF (`appendonly yes`). Memory: `256mb` + `allkeys-lru` (BullMQ keys are short-lived; adjust if needed).

---

## 6. Environment variables

```bash
cp .env.production.example .env
nano .env   # fill EVERY placeholder — never commit this file
```

### Required production variables

| Variable | Purpose |
|----------|---------|
| `NODE_ENV=production` | Enables secure cookies + production validation |
| `DATABASE_URL` | SQL Server `DigitalSocialMedia` connection |
| `REDIS_URL` | e.g. `redis://:YOUR_REDIS_PASSWORD@127.0.0.1:6379` |
| `WEB_ORIGIN` | `https://YOUR_DOMAIN` (CORS + OAuth return) |
| `API_HOST=127.0.0.1` | Bind API privately |
| `API_PORT=5000` | Nest listen port |
| `TRUST_PROXY=1` | Trust Nginx `X-Forwarded-*` |
| `NEXT_PUBLIC_API_URL` | `https://YOUR_DOMAIN` (baked at **build** time) |
| `API_INTERNAL_URL` | `http://127.0.0.1:5000` (SSR → Nest) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `GOOGLE_REDIRECT_URI` | `https://YOUR_DOMAIN/api/auth/google/callback` |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | ≥32 chars |
| `SESSION_SECRET` | ≥32 chars |
| `WORKSPACE_USER_EMAIL` | Workspace user bootstrap email |

### Optional (TikTok — connector pending)

| Variable | Purpose |
|----------|---------|
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | Login Kit |
| `TIKTOK_REDIRECT_URI` | `https://YOUR_DOMAIN/api/auth/tiktok/callback` |
| `TIKTOK_OAUTH_SCOPES` | `user.info.basic user.info.stats video.list` |

Generate secrets:

```bash
openssl rand -hex 32
```

**Never** put secrets in `NEXT_PUBLIC_*` variables.

---

## 7. Database (SQL Server)

- Database name must remain **`DigitalSocialMedia`**.
- Schema: **`social`**.
- This project uses **Prisma generate + introspection (`db pull`)**, not Prisma Migrate.
- **Do not** run: `prisma migrate reset`, `prisma db push`, DROP/TRUNCATE, or seed fake social data into production.

On the VPS after configuring `DATABASE_URL`:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:verify   # optional connectivity check
```

Preserve all historical tables (`SocialAccounts`, `SocialTokens`, posts, metrics, snapshots, sync jobs).

---

## 8. Build

`NEXT_PUBLIC_*` must be set **before** `pnpm build`:

```bash
set -a && source .env && set +a
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
pnpm deploy:check
```

Or use the deploy script (section 12).

---

## 9. PM2

```bash
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # follow the printed systemd command
pm2 status
```

Processes:

| Name | Role |
|------|------|
| `sma-web` | Next.js |
| `sma-api` | NestJS |
| `sma-worker` | BullMQ consumer |

Useful commands:

```bash
pm2 status
pm2 logs
pm2 logs sma-api
pm2 restart sma-api
pm2 reload ecosystem.config.cjs --update-env
pm2 stop all
pm2 start ecosystem.config.cjs
```

---

## 10. Nginx

```bash
sudo cp deploy/nginx/websocket-map.conf /etc/nginx/conf.d/sma-websocket-map.conf
sudo cp deploy/nginx/aviationsminute.conf /etc/nginx/sites-available/aviationsminute.conf
sudo nano /etc/nginx/sites-available/aviationsminute.conf   # replace YOUR_DOMAIN
sudo ln -sf /etc/nginx/sites-available/aviationsminute.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Proxy rules:

- `/` → Next.js
- `/api/` → Nest (path prefix kept; Nest uses global prefix `api`)

---

## 11. Domain + HTTPS

1. Point DNS A/AAAA records for `YOUR_DOMAIN` to the VPS public IP.
2. Issue a certificate:

```bash
sudo certbot --nginx -d YOUR_DOMAIN
```

3. Confirm HTTPS redirects and renewal:

```bash
sudo certbot renew --dry-run
```

---

## 12. OAuth production configuration

### Google (YouTube)

In Google Cloud Console → Credentials → OAuth Web client:

- Authorized JavaScript origins: `https://YOUR_DOMAIN`
- Authorized redirect URIs: `https://YOUR_DOMAIN/api/auth/google/callback`

Match `.env`:

```env
GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN/api/auth/google/callback
WEB_ORIGIN=https://YOUR_DOMAIN
```

Do **not** use `http://localhost:5000/...` in production.

After publishing the consent screen (Testing → Production), reconnect YouTube once so Google can issue a long-lived refresh token. Testing-mode tokens can expire in 7 days — the app cannot bypass that Google policy.

### TikTok (Login Kit)

When the TikTok connector is enabled:

- Redirect URI: `https://YOUR_DOMAIN/api/auth/tiktok/callback`
- Scopes only: `user.info.basic`, `user.info.stats`, `video.list`
- TikTok Web Login requires HTTPS
- Do not submit the TikTok app for review until the product is ready

---

## 13. Health checks

```bash
curl -fsS http://127.0.0.1:5000/api/health
curl -fsS http://127.0.0.1:5000/api/health/ready
curl -fsS https://YOUR_DOMAIN/api/health
curl -fsS https://YOUR_DOMAIN/api/health/ready
```

- `/api/health` — liveness (DB status in body)
- `/api/health/ready` — readiness (DB + Redis); returns **503** when degraded

---

## 14. Deploy / update

Preferred:

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

Flow:

1. Load `.env`
2. `pnpm install --frozen-lockfile`
3. `pnpm db:generate` (never migrate reset)
4. `pnpm build` (stop if fail — does not reload PM2)
5. `pnpm deploy:check`
6. `pm2 reload` / start
7. Verify `/api/health/ready`

This is **safe rolling restart**, not guaranteed zero-downtime. Expect brief interruption during PM2 reload.

---

## 15. Rollback

1. `git checkout <previous-good-commit>`
2. `set -a && source .env && set +a && pnpm install --frozen-lockfile && pnpm db:generate && pnpm build`
3. `pm2 reload ecosystem.config.cjs --update-env`
4. Verify health

Database:

- Prefer SQL Server native backups **before** any schema change.
- There is **no** Prisma migrate down path (introspection-only).
- Never delete `SocialTokens`, posts, or metrics to “fix” OAuth.

Redis:

- Safe to flush only if you accept losing in-flight BullMQ jobs.
- Do not flush as a routine deploy step.

---

## 16. What must NEVER be deleted

- Database `DigitalSocialMedia`
- Historical `SocialAccounts`, `SocialTokens`, `SocialPosts`, metrics, snapshots
- Production `.env`
- TLS certificates
- Redis data volume (unless intentionally resetting queues)

---

## 17. Troubleshooting

| Symptom | Check |
|---------|--------|
| CORS errors | `WEB_ORIGIN` must equal `https://YOUR_DOMAIN` |
| OAuth redirect mismatch | Google/TikTok console URI must match `GOOGLE_REDIRECT_URI` / `TIKTOK_REDIRECT_URI` |
| Cookies not set | `NODE_ENV=production`, HTTPS, `TRUST_PROXY=1` |
| API 502 from Nginx | `pm2 status`, `curl 127.0.0.1:5000/api/health` |
| Ready 503 | SQL Server or Redis down / wrong `DATABASE_URL` / `REDIS_URL` |
| Worker idle | Redis URL, `pm2 logs sma-worker` |
| Frontend calls wrong host | Rebuild after changing `NEXT_PUBLIC_API_URL` |
| Prisma EPERM on Windows | Stop running api/worker before `db:generate` |

Logs:

```bash
pm2 logs
tail -f logs/api-out.log logs/api-error.log
```

---

## 18. Local verification before VPS

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter @sma/database exec prisma validate --schema prisma/schema.prisma
```

Do not set `NODE_ENV=production` locally unless `.env` uses non-localhost HTTPS URLs (validators will reject localhost OAuth/web origins in production mode).
