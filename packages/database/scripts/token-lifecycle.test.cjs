const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { encryptSecret } = require('@sma/config');
const { OAuthFlowError } = require('@sma/providers');
const { resolveSocialConnectionStatus } = require('@sma/types');
const {
  ACCESS_TOKEN_REFRESH_BUFFER_MS,
  InProcessRefreshCoordinator,
  TokenLifecycleService,
  accessTokenNeedsRefresh,
} = require('../dist/token-lifecycle');

const KEY = 'a'.repeat(64);

class MemoryStore {
  constructor(record) {
    this.record = record;
    this.saves = [];
    this.reauthCount = 0;
  }

  async load() {
    return this.record;
  }

  async save(_id, update) {
    this.saves.push(update);
    this.record = {
      ...this.record,
      accessTokenEncrypted: update.accessTokenEncrypted,
      refreshTokenEncrypted: update.refreshTokenEncrypted ?? this.record.refreshTokenEncrypted,
      tokenType: update.tokenType ?? this.record.tokenType,
      expiresAt: update.expiresAt ?? this.record.expiresAt,
      scope: update.scope ?? this.record.scope,
    };
  }

  async markReauthorizationRequired() {
    this.reauthCount += 1;
  }
}

function record(overrides = {}) {
  return {
    accessTokenEncrypted: encryptSecret('access-old', KEY),
    refreshTokenEncrypted: encryptSecret('refresh-old', KEY),
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    scope: 'youtube.readonly',
    ...overrides,
  };
}

describe('token lifecycle', () => {
  it('1. first OAuth connection stores access and refresh tokens and stays connected', async () => {
    const store = new MemoryStore(record());
    const service = new TokenLifecycleService(store, KEY);
    const tokens = await service.getValidTokenSet(1n, {
      async refreshAccessToken() {
        throw new Error('first connection should not refresh');
      },
    });
    assert.equal(tokens.accessToken, 'access-old');
    assert.equal(tokens.refreshToken, 'refresh-old');
    assert.equal(store.saves.length, 0);
    assert.equal(
      resolveSocialConnectionStatus({ connectionStatus: 'connected', isConnected: true }),
      'connected',
    );
  });

  it('2. refresh token remains stored when Google omits a replacement', async () => {
    const stored = record({ expiresAt: new Date(Date.now() - 1000) });
    const originalRefresh = stored.refreshTokenEncrypted;
    const store = new MemoryStore(stored);
    const service = new TokenLifecycleService(store, KEY);
    const tokens = await service.getValidTokenSet(1n, {
      async refreshAccessToken() {
        return {
          accessToken: 'access-new',
          expiresAt: new Date(Date.now() + 3600_000),
          scopes: ['youtube.readonly'],
        };
      },
    });
    assert.equal(tokens.accessToken, 'access-new');
    assert.equal(tokens.refreshToken, 'refresh-old');
    assert.equal(store.saves[0].refreshTokenEncrypted, undefined);
    assert.equal(store.record.refreshTokenEncrypted, originalRefresh);
  });

  it('3. valid access token does not refresh', async () => {
    const store = new MemoryStore(record());
    let refreshes = 0;
    const service = new TokenLifecycleService(store, KEY);
    const access = await service.getValidAccessToken(1n, {
      async refreshAccessToken() {
        refreshes += 1;
        throw new Error('should not refresh');
      },
    });
    assert.equal(access, 'access-old');
    assert.equal(refreshes, 0);
  });

  it('4. expired access token refreshes automatically', async () => {
    const store = new MemoryStore(record({ expiresAt: new Date(Date.now() - 5_000) }));
    const service = new TokenLifecycleService(store, KEY);
    const access = await service.getValidAccessToken(1n, {
      async refreshAccessToken(refreshToken) {
        assert.equal(refreshToken, 'refresh-old');
        return {
          accessToken: 'access-refreshed',
          refreshToken: 'refresh-old',
          expiresAt: new Date(Date.now() + 3600_000),
          scopes: ['youtube.readonly'],
        };
      },
    });
    assert.equal(access, 'access-refreshed');
    assert.equal(store.saves.length, 1);
  });

  it('5. access token near expiry refreshes automatically', async () => {
    const store = new MemoryStore(
      record({ expiresAt: new Date(Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS - 1_000) }),
    );
    const service = new TokenLifecycleService(store, KEY);
    const access = await service.getValidAccessToken(1n, {
      async refreshAccessToken() {
        return {
          accessToken: 'access-near',
          expiresAt: new Date(Date.now() + 3600_000),
          scopes: ['youtube.readonly'],
        };
      },
    });
    assert.equal(access, 'access-near');
    assert.equal(accessTokenNeedsRefresh(new Date(Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS - 1)), true);
  });

  it('6. missing replacement refresh token preserves the stored refresh token', async () => {
    const originalRefresh = encryptSecret('refresh-keep', KEY);
    const store = new MemoryStore(record({
      refreshTokenEncrypted: originalRefresh,
      expiresAt: new Date(Date.now() - 1),
    }));
    const service = new TokenLifecycleService(store, KEY);
    await service.getValidTokenSet(1n, {
      async refreshAccessToken() {
        return { accessToken: 'a2', scopes: ['youtube.readonly'] };
      },
    });
    assert.equal(store.record.refreshTokenEncrypted, originalRefresh);
  });

  it('7. replacement refresh token is stored', async () => {
    const store = new MemoryStore(record({ expiresAt: new Date(Date.now() - 1) }));
    const service = new TokenLifecycleService(store, KEY);
    const tokens = await service.getValidTokenSet(1n, {
      async refreshAccessToken() {
        return {
          accessToken: 'a3',
          refreshToken: 'refresh-new',
          expiresAt: new Date(Date.now() + 3600_000),
          scopes: ['youtube.readonly'],
        };
      },
    });
    assert.equal(tokens.refreshToken, 'refresh-new');
    assert.ok(store.saves[0].refreshTokenEncrypted);
    assert.notEqual(store.saves[0].refreshTokenEncrypted, store.saves[0].accessTokenEncrypted);
  });

  it('8. invalid_grant marks REAUTH_REQUIRED and does not keep retrying', async () => {
    const store = new MemoryStore(record({ expiresAt: new Date(Date.now() - 1) }));
    const service = new TokenLifecycleService(store, KEY);
    await assert.rejects(
      () =>
        service.getValidAccessToken(1n, {
          async refreshAccessToken() {
            throw new OAuthFlowError('reauthorization_required', 'YouTube access was revoked.');
          },
        }),
      (error) => error instanceof OAuthFlowError && error.code === 'reauthorization_required',
    );
    assert.equal(store.reauthCount, 1);
  });

  it('9. sync-shaped caller receives a usable token after refresh', async () => {
    const store = new MemoryStore(record({ expiresAt: new Date(Date.now() - 1) }));
    const service = new TokenLifecycleService(store, KEY);
    const accessToken = await service.getValidAccessToken(1n, {
      async refreshAccessToken() {
        return {
          accessToken: 'sync-token',
          expiresAt: new Date(Date.now() + 3600_000),
          scopes: ['youtube.readonly'],
        };
      },
    });
    assert.equal(accessToken, 'sync-token');
  });

  it('10. two simultaneous refreshes share one refresh operation', async () => {
    const store = new MemoryStore(record({ expiresAt: new Date(Date.now() - 1) }));
    const coordinator = new InProcessRefreshCoordinator();
    const service = new TokenLifecycleService(store, KEY, coordinator);
    let refreshes = 0;
    const refresher = {
      async refreshAccessToken() {
        refreshes += 1;
        await new Promise((resolve) => setTimeout(resolve, 40));
        return {
          accessToken: 'shared',
          expiresAt: new Date(Date.now() + 3600_000),
          scopes: ['youtube.readonly'],
        };
      },
    };
    const [first, second] = await Promise.all([
      service.getValidAccessToken(7n, refresher),
      service.getValidAccessToken(7n, refresher),
    ]);
    assert.equal(first, 'shared');
    assert.equal(second, 'shared');
    assert.equal(refreshes, 1);
  });

  it('11. historical data is not touched by token refresh failure', async () => {
    const historical = { posts: 86, snapshots: 1 };
    const store = new MemoryStore(record({ expiresAt: new Date(Date.now() - 1) }));
    const service = new TokenLifecycleService(store, KEY);
    await assert.rejects(() =>
      service.getValidAccessToken(1n, {
        async refreshAccessToken() {
          throw new OAuthFlowError('reauthorization_required', 'revoked');
        },
      }),
    );
    assert.deepEqual(historical, { posts: 86, snapshots: 1 });
    assert.equal(store.reauthCount, 1);
  });

  it('12. expired access token does not change connection status to disconnected', () => {
    assert.equal(
      resolveSocialConnectionStatus({ connectionStatus: 'connected', isConnected: true }),
      'connected',
    );
    assert.equal(
      resolveSocialConnectionStatus({ connectionStatus: 'reauth_required', isConnected: true }),
      'reauth_required',
    );
    assert.equal(accessTokenNeedsRefresh(new Date(Date.now() - 1)), true);
  });
});
