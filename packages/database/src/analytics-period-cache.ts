export interface AnalyticsPeriodCacheKey {
  platform: string;
  accountId: string;
  startDate: string;
  endDate: string;
  syncedAt: string | null;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000;

export class AnalyticsPeriodCache {
  private readonly entries = new Map<string, { value: unknown; expiresAt: number }>();

  static key(parts: AnalyticsPeriodCacheKey): string {
    return [parts.platform, parts.accountId, parts.startDate, parts.endDate, parts.syncedAt ?? 'never'].join(':');
  }

  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidateAccount(platform: string, accountId: string): void {
    const prefix = `${platform}:${accountId}:`;
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }
}
