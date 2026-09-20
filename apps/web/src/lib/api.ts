/**
 * Resolves the Nest API origin for browser and SSR fetches.
 *
 * Production (Nginx same-origin):
 *   NEXT_PUBLIC_API_URL=https://YOUR_DOMAIN   (no trailing /api)
 *   API_INTERNAL_URL=http://127.0.0.1:5000    (SSR → Nest directly)
 *
 * Empty NEXT_PUBLIC_API_URL in the browser means same-origin relative URLs
 * (works when Nginx proxies /api to Nest).
 */
export function resolveApiBaseUrl(): string {
  const publicUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const internalUrl = process.env.API_INTERNAL_URL?.trim();

  if (typeof window === 'undefined') {
    const serverBase = internalUrl || publicUrl || 'http://127.0.0.1:5000';
    return serverBase.replace(/\/$/, '');
  }

  if (!publicUrl || publicUrl === '/') {
    return '';
  }

  return publicUrl.replace(/\/$/, '');
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const baseUrl = resolveApiBaseUrl();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: 'no-store',
      credentials: 'include',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      return { ok: false, error: body?.message ?? `API responded with ${response.status}` };
    }

    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, error: 'The API is not reachable.' };
  }
}
