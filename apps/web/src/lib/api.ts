export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

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
