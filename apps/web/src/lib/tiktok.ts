import { resolveApiBaseUrl } from '@/lib/api';

/**
 * Browser navigation target for TikTok OAuth.
 * Uses the same API origin resolution as fetchApi / YouTube data calls
 * (NEXT_PUBLIC_API_URL in the browser; SSR falls back to API_INTERNAL_URL
 * or http://127.0.0.1:5000 so the Nest OAuth route is never hit on :3000).
 */
export function tiktokConnectUrl(): string {
  const baseUrl = resolveApiBaseUrl();
  return `${baseUrl}/api/auth/tiktok`;
}
