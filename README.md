# Social Media Analytics

Production SaaS foundation for multi-platform social media analytics.

The first live integration will be **YouTube**. Other platforms are reserved in the architecture and must never display fake metrics.

## Purpose

Connect social accounts, synchronize real platform data, store it in Microsoft SQL Server, and present analytics through a professional dashboard.

This repository includes a working YouTube OAuth + analytics path, BullMQ sync workers, and VPS deployment assets. See [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup.

## Architecture

```text
Internet → Nginx (HTTPS)
              ├── /      → Next.js (apps/web)
              └── /api/  → NestJS (apps/api)
                              ↓
                     SQL Server (DigitalSocialMedia)
                              ↓
                     Redis + Worker (BullMQ)
                              ↓
                     YouTube / future platforms (@sma/providers)
```

The domain is platform-agnostic. YouTube is the first live `SocialPlatformProvider`. TikTok Login Kit env placeholders are reserved; the connector is not production-live yet.

Unsupported platforms render **Coming Soon** / **ستتاح قريبًا**. They do not invent numbers.

## Technology stack

| Layer      | Choice                              |
| ---------- | ----------------------------------- |
| Monorepo   | pnpm workspaces + Turborepo         |
| Frontend   | Next.js, TypeScript, Tailwind CSS   |
| Backend    | NestJS, TypeScript                  |
| Database   | Microsoft SQL Server + Prisma       |
| Jobs       | Redis + BullMQ                      |
| Validation | Zod                                 |
| Quality    | ESLint, Prettier, strict TypeScript |
| Containers | Docker Compose for Redis only       |

## Folder structure

```text
.
├── apps/
│   ├── api/          NestJS HTTP API
│   ├── web/          Next.js dashboard shell
│   └── worker/       BullMQ sync workers
├── packages/
│   ├── config/       Environment validation and logging
│   ├── database/     Prisma client and repositories
│   ├── eslint-config/
│   ├── providers/    SocialPlatformProvider adapters
│   └── types/        Shared domain and API contracts
├── docker/
├── docker-compose.yml
├── .env.example
└── turbo.json
```

## Prerequisites

- Node.js 20.19+
- pnpm 10+
- Docker Desktop (for Redis)
- Access to the existing SQL Server database `DigitalSocialMedia`

Do **not** create a new SQL Server container. The schema `social` already exists.

## Local development

```bash
pnpm install
copy .env.example .env   # Windows
# cp .env.example .env  # macOS / Linux
```

Fill `DATABASE_URL` with the existing SQL Server connection string. Fill Google OAuth values from Google Cloud. Never paste secrets into source files.

### Redis

```bash
docker compose up -d redis
```

SQL Server is not started by Compose. Applications connect through `DATABASE_URL`.

### Database / Prisma

The existing SQL Server database `DigitalSocialMedia` (schema `social`) is the source of truth.

`DATABASE_URL` lives only in the local `.env` file. `.env.example` contains an empty `DATABASE_URL=` placeholder and must never contain real credentials.

Prisma connects with:

```text
provider = "sqlserver"
url      = env("DATABASE_URL")
```

Supported URL shapes:

```text
sqlserver://HOST:1433;database=DigitalSocialMedia;user=USER;password=PASSWORD;encrypt=true;trustServerCertificate=true
sqlserver://HOST:1433;database=DigitalSocialMedia;integratedSecurity=true;encrypt=true;trustServerCertificate=true
```

Prisma's SQL Server engine uses TCP. Local SQL Express must have TCP/IP enabled and listening (typically port 1433). Shared Memory connections that work in SSMS/`sqlcmd` are not enough for Prisma.

If TCP/IP is disabled on SQL Express, run this script in an elevated PowerShell session, then retry `pnpm db:pull` and `pnpm db:verify`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File packages/database/scripts/enable-sql-tcp.ps1
```

Safe commands:

```bash
copy .env.example .env
# set DATABASE_URL to DigitalSocialMedia only

pnpm db:pull              # read-only introspection; updates prisma/schema.prisma
pnpm db:generate          # generate Prisma Client
pnpm db:verify:readonly   # SELECT 1 + read social.Platforms via sqlcmd
pnpm db:verify            # same checks through Prisma (requires TCP)
```

`GET /api/health` reports `{ "status": "ok", "database": "connected" }` when Prisma can run `SELECT 1`. It never returns credentials, connection strings, or stack traces.

**Never run these against this database:**

- `prisma migrate reset`
- `prisma db push`
- `DROP` / `TRUNCATE` / destructive migrations
- any command that creates, alters, or deletes tables

`prisma db pull` is the only Prisma schema command allowed. It reads the live schema; it does not change SQL Server.

### Run applications

```bash
pnpm dev
```

Or separately:

```bash
pnpm dev:web      # http://localhost:3000
pnpm dev:api      # http://localhost:5000
pnpm dev:worker
```

### Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

## Environment variables

See `.env.example`. Required values include:

- `DATABASE_URL` — existing SQL Server
- `REDIS_URL` — local Redis
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — never hardcode
- `GOOGLE_REDIRECT_URI` — currently `http://localhost:5000/api/auth/google/callback`
- `NEXT_PUBLIC_API_URL` — frontend to API

`.env`, Google OAuth JSON downloads, and service account files are gitignored.

## Security rules

- Secrets live only in environment variables.
- Access tokens and refresh tokens must never be logged.
- Google Cloud OAuth client JSON must never be committed.
- Analytics endpoints do not return demo or placeholder metrics.

## Future platform integrations

Provider contract: `packages/providers`.

- YouTube is implemented (OAuth, sync, analytics periods, token lifecycle).
- Instagram, Facebook, TikTok, LinkedIn, X, and Snapchat are catalogued as coming soon.
- TikTok Login Kit environment placeholders exist for production HTTPS callbacks; the connector itself is not live yet.
- Adding a platform means implementing `SocialPlatformProvider`, registering it, and mapping sync jobs. Core modules should not become platform-specific.

## Current status

Implemented:

- Monorepo foundation (pnpm + Turborepo)
- Prisma mapping of the existing `social` schema (introspection + generate; no migrate reset)
- NestJS API + BullMQ worker + Next.js web
- Health checks (`/api/health`, `/api/health/ready`)
- YouTube OAuth, encrypted tokens, refresh lifecycle, sync jobs, analytics
- VPS deployment assets (PM2, Nginx template, Redis compose, `DEPLOYMENT.md`)

Not live yet:

- TikTok connector (env reserved only)
- Other social integrations
