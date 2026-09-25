# TikTok Connector

Platform-agnostic TikTok Login Kit + Display API v2 integration for Aviationsminute Social Media.

## OAuth flow

1. User opens **Connect TikTok** → `GET /api/auth/tiktok`
2. API creates a cryptographically random `state`, stores it in a signed HttpOnly cookie, and redirects to:

   `https://www.tiktok.com/v2/auth/authorize/`

   with `client_key`, `response_type=code`, scopes, `redirect_uri`, and `state`.

   Login Kit **Web** does **not** use PKCE (`code_challenge` / `code_verifier`). Those apply to Desktop / iOS / Android only.

3. TikTok redirects to:

   `GET /api/auth/tiktok/callback?code=...&state=...`

4. API validates `state`, exchanges the code server-side at
   `https://open.tiktokapis.com/v2/oauth/token/` with `client_key`, `client_secret`, `code`,
   `grant_type=authorization_code`, and `redirect_uri`, encrypts tokens, upserts
   `SocialAccounts` / `SocialTokens` / profile fields, sets status `connected`,
   queues an initial sync, and redirects to `/tiktok?status=connected`.

Tokens, `client_secret`, and authorization codes never appear in URLs, localStorage, browser JSON, or logs.

## Required environment variables

```bash
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
TIKTOK_REDIRECT_URI=https://aviationsminuteanalysis.com/api/auth/tiktok/callback
TIKTOK_OAUTH_SCOPES=user.info.basic user.info.stats video.list
```

Local development may use a localhost redirect **only if** that exact URI is registered in the TikTok Developer Portal. Do not replace the production URI in production env files.

Also required (shared): `DATABASE_URL`, `REDIS_URL`, `SOCIAL_TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET`.

## Required TikTok products / scopes

- Login Kit
- `user.info.basic`
- `user.info.stats`
- `video.list`

## API endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/auth/tiktok` | Start OAuth |
| GET | `/api/auth/tiktok/callback` | OAuth callback |
| GET | `/api/tiktok/connection` | Connection status |
| GET | `/api/tiktok/analytics` | Period analytics (`preset` / custom range) |
| POST | `/api/tiktok/sync` | Queue BullMQ sync |
| GET | `/api/tiktok/sync/status` | Latest sync job status |

## Sync architecture

- `POST /api/tiktok/sync` creates a `SyncJobs` row and enqueues BullMQ `social-sync` with `platformCode: tiktok`.
- Worker loads the account, refreshes tokens via `TokenLifecycleService`, calls:
  - `GET https://open.tiktokapis.com/v2/user/info/`
  - `POST https://open.tiktokapis.com/v2/video/list/` (paginated)
- Upserts `SocialProfiles` / account metrics / `SocialPosts` / `PostMetrics` / daily `MetricSnapshots`.
- Historical rows are retained when tokens expire; status becomes `reauth_required`.

Period analytics sum **synced videos published in the selected range**. Aggregate account “total views” is not invented when TikTok does not provide it (shown as N/A / null).

## Database

Reuses existing `social.*` tables. Ensure a Platforms row exists:

```bash
node packages/database/scripts/ensure-tiktok-platform.cjs
```

No TikTok-only tables. No migrate reset.

## Deployment requirements

- Register production callback:
  `https://aviationsminuteanalysis.com/api/auth/tiktok/callback`
- Set TikTok env vars on `sma-api` and `sma-worker` only.
- Redis must be up for sync jobs.
- Nginx already proxies `/api/` to the Nest API — no path change required for TikTok routes.
- Do not restart unrelated PM2 apps.

## How to test locally

1. Copy TikTok keys into `.env` (never commit them).
2. Register a local callback in the TikTok portal if testing OAuth locally, **or** test against the production redirect only from the deployed host.
3. `pnpm --filter @sma/database exec node scripts/ensure-tiktok-platform.cjs`
4. Start Redis, API, worker, web.
5. Open `/tiktok` → Connect → complete OAuth → Sync → confirm metrics (null fields stay N/A).

## Automated checks

```bash
pnpm --filter @sma/providers test
pnpm --filter @sma/database test
pnpm --filter @sma/api typecheck
pnpm --filter @sma/worker typecheck
pnpm --filter @sma/web typecheck
```
