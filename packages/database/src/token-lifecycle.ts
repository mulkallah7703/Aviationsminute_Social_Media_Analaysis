import { decryptSecret, encryptSecret } from '@sma/config';
import { OAuthFlowError } from '@sma/providers';
import type { OAuthTokenSet } from '@sma/types';

export const ACCESS_TOKEN_REFRESH_BUFFER_MS = 60_000;

export interface EncryptedTokenRecord {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  tokenType: string | null;
  expiresAt: Date | null;
  scope: string | null;
}

export interface TokenLifecycleStore {
  load(socialAccountId: bigint): Promise<EncryptedTokenRecord | null>;
  save(
    socialAccountId: bigint,
    update: {
      accessTokenEncrypted: string;
      refreshTokenEncrypted?: string;
      tokenType?: string | null;
      expiresAt?: Date | null;
      scope?: string | null;
    },
  ): Promise<void>;
  markReauthorizationRequired(socialAccountId: bigint): Promise<void>;
  withExclusiveAccess?<T>(socialAccountId: bigint, operation: () => Promise<T>): Promise<T>;
}

export interface TokenRefreshAdapter {
  refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet>;
}

export interface RefreshCoordinator {
  run<T>(key: string, operation: () => Promise<T>): Promise<T>;
}

export class InProcessRefreshCoordinator implements RefreshCoordinator {
  private readonly inflight = new Map<string, Promise<unknown>>();

  run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }
    const pending = operation().finally(() => {
      this.inflight.delete(key);
    });
    this.inflight.set(key, pending);
    return pending;
  }
}

export function accessTokenNeedsRefresh(expiresAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) {
    return true;
  }
  return expiresAt.getTime() <= now.getTime() + ACCESS_TOKEN_REFRESH_BUFFER_MS;
}

export class TokenLifecycleService {
  constructor(
    private readonly store: TokenLifecycleStore,
    private readonly encryptionKey: string,
    private readonly coordinator: RefreshCoordinator = new InProcessRefreshCoordinator(),
  ) {}

  async getValidAccessToken(
    socialAccountId: bigint,
    refresher: TokenRefreshAdapter,
    options?: { forceRefresh?: boolean; now?: Date },
  ): Promise<string> {
    const tokens = await this.getValidTokenSet(socialAccountId, refresher, options);
    return tokens.accessToken;
  }

  async getValidTokenSet(
    socialAccountId: bigint,
    refresher: TokenRefreshAdapter,
    options?: { forceRefresh?: boolean; now?: Date },
  ): Promise<OAuthTokenSet> {
    const now = options?.now ?? new Date();
    const stored = await this.store.load(socialAccountId);
    if (!stored) {
      throw new OAuthFlowError(
        'reauthorization_required',
        'YouTube tokens are missing. Connect YouTube again.',
      );
    }

    const current = this.decryptRecord(stored);
    if (!options?.forceRefresh && !accessTokenNeedsRefresh(current.expiresAt ?? null, now)) {
      return current;
    }

    const exclusive = (operation: () => Promise<OAuthTokenSet>): Promise<OAuthTokenSet> =>
      this.store.withExclusiveAccess
        ? this.store.withExclusiveAccess(socialAccountId, operation)
        : operation();

    return this.coordinator.run(`social-token:${socialAccountId.toString()}`, () =>
      exclusive(async () => {
        const latest = await this.store.load(socialAccountId);
        if (!latest) {
          throw new OAuthFlowError(
            'reauthorization_required',
            'YouTube tokens are missing. Connect YouTube again.',
          );
        }
        const latestTokens = this.decryptRecord(latest);
        if (!options?.forceRefresh && !accessTokenNeedsRefresh(latestTokens.expiresAt ?? null, now)) {
          return latestTokens;
        }
        return this.refreshAndPersist(socialAccountId, latestTokens, refresher);
      }),
    );
  }

  private async refreshAndPersist(
    socialAccountId: bigint,
    current: OAuthTokenSet,
    refresher: TokenRefreshAdapter,
  ): Promise<OAuthTokenSet> {
    if (!current.refreshToken) {
      await this.store.markReauthorizationRequired(socialAccountId);
      throw new OAuthFlowError(
        'reauthorization_required',
        'A YouTube refresh token is not available. Connect YouTube again.',
      );
    }

    try {
      const refreshed = await refresher.refreshAccessToken(current.refreshToken);
      const next: OAuthTokenSet = {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? current.refreshToken,
        expiresAt: refreshed.expiresAt ?? current.expiresAt,
        scopes: refreshed.scopes.length > 0 ? refreshed.scopes : current.scopes,
        tokenType: refreshed.tokenType ?? current.tokenType,
      };

      await this.store.save(socialAccountId, {
        accessTokenEncrypted: encryptSecret(next.accessToken, this.encryptionKey),
        refreshTokenEncrypted: refreshed.refreshToken
          ? encryptSecret(refreshed.refreshToken, this.encryptionKey)
          : undefined,
        tokenType: next.tokenType ?? null,
        expiresAt: next.expiresAt ?? null,
        scope: next.scopes.join(' '),
      });

      return next;
    } catch (error) {
      if (error instanceof OAuthFlowError && error.code === 'reauthorization_required') {
        await this.store.markReauthorizationRequired(socialAccountId);
      }
      throw error;
    }
  }

  private decryptRecord(stored: EncryptedTokenRecord): OAuthTokenSet {
    return {
      accessToken: decryptSecret(stored.accessTokenEncrypted, this.encryptionKey),
      refreshToken: stored.refreshTokenEncrypted
        ? decryptSecret(stored.refreshTokenEncrypted, this.encryptionKey)
        : undefined,
      expiresAt: stored.expiresAt ?? undefined,
      scopes: stored.scope?.split(/\s+/).filter(Boolean) ?? [],
      tokenType: stored.tokenType ?? undefined,
    };
  }
}
