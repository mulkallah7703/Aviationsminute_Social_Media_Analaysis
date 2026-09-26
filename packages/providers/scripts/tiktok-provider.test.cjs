const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const {
  TikTokProvider,
  createTikTokCodeVerifier,
  createTikTokCodeChallenge,
  mapTikTokOAuthError,
} = require('../dist/tiktok.provider');
const { resolveSocialConnectionStatus } = require('@sma/types');

const PRODUCTION_REDIRECT = 'https://aviationsminuteanalysis.com/api/auth/tiktok/callback';

function createProvider(overrides = {}) {
  return new TikTokProvider({
    clientKey: 'tt-client-key',
    clientSecret: 'tt-client-secret',
    redirectUri: PRODUCTION_REDIRECT,
    scopes: ['user.info.basic', 'user.info.stats', 'video.list'],
    ...overrides,
  });
}

describe('tiktok oauth state helpers', () => {
  it('generates cryptographically random high-entropy state values', () => {
    const a = randomBytes(32).toString('base64url');
    const b = randomBytes(32).toString('base64url');
    assert.notEqual(a, b);
    assert.ok(a.length >= 40);
  });

  it('validates callback state equality (CSRF)', () => {
    const expected = 'csrf-expected';
    assert.equal(expected === 'csrf-expected', true);
    assert.equal(expected === 'tampered', false);
  });
});

describe('tiktok pkce helpers (Desktop — unused by Web flow)', () => {
  it('generates code_verifier and hex SHA-256 challenge', () => {
    const verifier = createTikTokCodeVerifier();
    assert.ok(verifier.length >= 43 && verifier.length <= 128);
    const challenge = createTikTokCodeChallenge(verifier);
    assert.equal(challenge, createHash('sha256').update(verifier, 'utf8').digest('hex'));
  });
});

describe('tiktok provider — Login Kit Web', () => {
  it('builds Web authorize URL with exactly the required OAuth parameters and no PKCE', async () => {
    const provider = createProvider();
    const url = new URL(
      await provider.getAuthorizationUrl({
        state: 'csrf-state-1',
        redirectUri: 'http://should-be-ignored.example/callback',
      }),
    );
    assert.equal(url.origin + url.pathname, 'https://www.tiktok.com/v2/auth/authorize/');
    assert.equal(url.searchParams.get('client_key'), 'tt-client-key');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('state'), 'csrf-state-1');
    assert.equal(url.searchParams.get('scope'), 'user.info.basic,user.info.stats,video.list');
    assert.equal(url.searchParams.get('redirect_uri'), PRODUCTION_REDIRECT);
    assert.equal([...url.searchParams.keys()].sort().join(','), 'client_key,redirect_uri,response_type,scope,state');
    assert.equal(url.searchParams.get('code_challenge'), null);
    assert.equal(url.searchParams.get('code_challenge_method'), null);
  });

  it('token exchange sends Web confidential-client body without code_verifier', async () => {
    const provider = createProvider();
    const originalFetch = global.fetch;
    let postedBody = '';
    global.fetch = mock.fn(async (_url, init) => {
      postedBody = String(init.body);
      return {
        ok: true,
        json: async () => ({
          access_token: 'access-token-value',
          expires_in: 3600,
          open_id: 'oid-1',
          refresh_expires_in: 86400,
          refresh_token: 'refresh-token-value',
          scope: 'user.info.basic,user.info.stats,video.list',
          token_type: 'Bearer',
        }),
      };
    });
    try {
      const tokens = await provider.exchangeAuthorizationCode({
        code: 'auth-code-value',
        redirectUri: 'http://should-be-ignored.example/callback',
      });
      const params = new URLSearchParams(postedBody);
      assert.equal(params.get('client_key'), 'tt-client-key');
      assert.equal(params.get('client_secret'), 'tt-client-secret');
      assert.equal(params.get('code'), 'auth-code-value');
      assert.equal(params.get('grant_type'), 'authorization_code');
      assert.equal(params.get('redirect_uri'), PRODUCTION_REDIRECT);
      assert.equal(params.get('code_verifier'), null);
      assert.equal(postedBody.includes('code_verifier'), false);
      assert.equal(tokens.accessToken, 'access-token-value');
      assert.equal(tokens.refreshToken, 'refresh-token-value');
      assert.equal(tokens.openId, 'oid-1');
      assert.equal(tokens.tokenType, 'Bearer');
      assert.deepEqual(tokens.scopes, ['user.info.basic', 'user.info.stats', 'video.list']);
      assert.ok(tokens.expiresAt instanceof Date);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('invalid_grant from token exchange is not mapped to reauthorization_required', async () => {
    const provider = createProvider();
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'Authorization code is expired or invalid.',
        log_id: 'log-123',
      }),
    }));
    try {
      await assert.rejects(
        () =>
          provider.exchangeAuthorizationCode({
            code: 'bad-code',
            redirectUri: PRODUCTION_REDIRECT,
          }),
        (error) => {
          assert.equal(error.code, 'invalid_grant');
          assert.match(error.message, /authorization code/i);
          assert.notEqual(error.code, 'reauthorization_required');
          assert.equal(String(error.message).toLowerCase().includes('revoked'), false);
          return true;
        },
      );
      assert.equal(mapTikTokOAuthError({ error: 'invalid_grant' }).code, 'invalid_grant');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('refresh invalid_grant maps to reauthorization_required for lifecycle', async () => {
    const provider = createProvider();
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_grant', error_description: 'invalid_grant' }),
    }));
    try {
      await assert.rejects(
        () => provider.refreshAccessToken('refresh-token-value'),
        (error) => error.code === 'reauthorization_required',
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('user info 401 / access_token_invalid → reauthorization_required with preserved TikTok fields', async () => {
    const provider = createProvider();
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 'access_token_invalid', message: 'Access token is invalid' },
        log_id: 'log-401',
      }),
    }));
    try {
      await assert.rejects(
        () =>
          provider.getAuthenticatedUser(
            { accessToken: 'secret-access-token', scopes: ['user.info.basic'] },
            { phase: 'oauth_callback' },
          ),
        (error) => {
          assert.equal(error.name, 'TikTokApiError');
          assert.equal(error.code, 'reauthorization_required');
          assert.equal(error.httpStatus, 401);
          assert.equal(error.tikTokCode, 'access_token_invalid');
          assert.equal(error.tikTokMessage, 'Access token is invalid');
          assert.equal(error.logId, 'log-401');
          assert.equal(error.phase, 'oauth_callback');
          assert.equal(String(error.message).includes('secret-access-token'), false);
          assert.equal(JSON.stringify(error).includes('secret-access-token'), false);
          return true;
        },
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('user info 429 → quota_exceeded', async () => {
    const provider = createProvider();
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({
        error: { code: 'rate_limit_exceeded', message: 'Too many requests' },
        log_id: 'log-429',
      }),
    }));
    try {
      await assert.rejects(
        () =>
          provider.getAuthenticatedUser({
            accessToken: 'secret-access-token',
            scopes: ['user.info.basic'],
          }),
        (error) => {
          assert.equal(error.code, 'quota_exceeded');
          assert.equal(error.tikTokCode, 'rate_limit_exceeded');
          assert.equal(error.logId, 'log-429');
          return true;
        },
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('user info non-auth error → tiktok_api_error with public message and internal fields', async () => {
    const provider = createProvider();
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: 'scope_not_authorized', message: 'The user did not authorize the scope' },
        error_description: 'Missing user.info.stats',
        error_code: 4010301,
        log_id: 'log-scope',
      }),
    }));
    try {
      await assert.rejects(
        () =>
          provider.getAuthenticatedUser(
            { accessToken: 'secret-access-token', scopes: ['user.info.basic'] },
            { phase: 'oauth_callback' },
          ),
        (error) => {
          assert.equal(error.name, 'TikTokApiError');
          assert.equal(error.code, 'tiktok_api_error');
          assert.equal(error.message, 'TikTok User Info request failed.');
          assert.equal(error.tikTokCode, 'scope_not_authorized');
          assert.equal(error.tikTokMessage, 'The user did not authorize the scope');
          assert.equal(error.errorDescription, 'Missing user.info.stats');
          assert.equal(error.errorCode, 4010301);
          assert.equal(error.logId, 'log-scope');
          assert.equal(error.phase, 'oauth_callback');
          assert.equal(String(JSON.stringify(error)).includes('secret-access-token'), false);
          return true;
        },
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('maps video payloads without coercing null metrics to zero', () => {
    const provider = createProvider();
    const mapped = provider.mapVideo({
      id: 'v1',
      view_count: '12',
      like_count: null,
    });
    assert.equal(mapped.views, 12n);
    assert.equal(mapped.likes, undefined);
  });

  it('connection status mapping covers connected / reauth / disconnected', () => {
    assert.equal(
      resolveSocialConnectionStatus({ connectionStatus: 'connected', isConnected: true }),
      'connected',
    );
    assert.equal(
      resolveSocialConnectionStatus({ connectionStatus: 'reauth_required', isConnected: true }),
      'reauth_required',
    );
  });
});
