/**
 * Browser navigation target for TikTok OAuth.
 * Always use a same-origin relative path so Nginx (production) or a local
 * reverse-proxy can forward /api to Nest. Never use API_INTERNAL_URL here —
 * that is for SSR fetches only and must not become the browser location.
 */
export function tiktokConnectUrl(): string {
  return '/api/auth/tiktok';
}
