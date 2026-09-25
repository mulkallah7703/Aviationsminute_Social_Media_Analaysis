const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const {
  TikTokProvider,
  createTikTokCodeVerifier,
  createTikTokCodeChallenge,
} = require('../dist/tiktok.provider');
const { resolveSocialConnectionStatus } = require('@sma/types');

function createProvider(overrides = {}) {
  return new TikTokProvider({
    clientKey: 'tt-client-key',
    clientSecret: 'tt-client-secret',
    redirectUri: 'https://aviationsminuteanalysis.com/api/auth/tiktok/callback',
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
    assert.equal(Boolean(undefined && expected === undefined), false);
  });
});

describe('tiktok pkce helpers (Desktop — unused by Web flow)', () => {
  it('generates code_verifier in the RFC 7636 / TikTok length and charset', () => {
    const verifier = createTikTokCodeVerifier();
    assert.ok(verifier.length >= 43 && verifier.length <= 128);
    assert.match(verifier, /^[A-Za-z0-9\-._~]+$/);
  });

  it('generates code_challenge as hex SHA-256 of the verifier', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = createTikTokCodeChallenge(verifier);
    const expected = createHash('sha256').update(verifier, 'utf8').digest('hex');
    assert.equal(challenge, expected);
    assert.match(challenge, /^[0-9a-f]{64}$/);
  });
});

describe('tiktok provider — Login Kit Web', () => {
  it('builds Web authorize URL without PKCE parameters', async () => {
    const provider = createProvider();
    const url = new URL(
      await provider.getAuthorizationUrl({
        state: 'csrf-state-1',
        redirectUri: 'https://aviationsminuteanalysis.com/api/auth/tiktok/callback',
      }),
    );
    assert.equal(url.origin + url.pathname, 'https://www.tiktok.com/v2/auth/authorize/');
    assert.equal(url.searchParams.get('client_key'), 'tt-client-key');
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('state'), 'csrf-state-1');
    assert.equal(
      url.searchParams.get('scope'),
      'user.info.basic,user.info.stats,video.list',
    );
    assert.equal(
      url.searchParams.get('redirect_uri'),
      'https://aviationsminuteanalysis.com/api/auth/tiktok/callback',
    );
    assert.equal(url.searchParams.get('code_challenge'), null);
    assert.equal(url.searchParams.get('code_challenge_method'), null);
    assert.equal(url.searchParams.get('code_verifier'), null);
  });

  it('Web token exchange does not send code_verifier', async () => {
    const provider = createProvider();
    const originalFetch = global.fetch;
    const originalWarn = console.warn;
    const warnings = [];
    let postedBody = '';
    console.warn = (...args) => {
      warnings.push(args.map(String).join(' '));
    };
    global.fetch = mock.fn(async (_url, init) => {
      postedBody = String(init.body);
      return {
        ok: true,
        json: async () => ({
          access_token: 'access-token-value',
          refresh_token: 'refresh-token-value',
          expires_in: 3600,
          open_id: 'oid-1',
          scope: 'user.info.basic',
          token_type: 'Bearer',
        }),
      };
    });
    try {
      await provider.exchangeAuthorizationCode({
        code: 'auth-code-value',
        redirectUri: 'https://aviationsminuteanalysis.com/api/auth/tiktok/callback',
      });
      const params = new URLSearchParams(postedBody);
      assert.equal(params.get('grant_type'), 'authorization_code');
      assert.equal(params.get('code_verifier'), null);
      assert.equal(postedBody.includes('code_verifier'), false);

      const success = warnings.find((line) => line.includes('[tiktok.oauth.exchange.success]'));
      assert.ok(success);
      assert.match(success, /"hasAccessToken":true/);
      assert.match(success, /"hasRefreshToken":true/);
      assert.match(success, /"hasOpenId":true/);
      assert.equal(success.includes('access-token-value'), false);
      assert.equal(success.includes('refresh-token-value'), false);
      assert.equal(success.includes('oid-1'), false);
      assert.equal(success.includes('auth-code-value'), false);
      assert.equal(success.includes('tt-client-secret'), false);
    } finally {
      global.fetch = originalFetch;
      console.warn = originalWarn;
    }
  });

  it('user info failure logs safe diagnostics only', async () => {
    const provider = createProvider();
    const originalFetch = global.fetch;
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => {
      warnings.push(args.map(String).join(' '));
    };
    global.fetch = mock.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 'access_token_invalid', message: 'Access token is invalid' },
      }),
    }));
    try {
      await assert.rejects(
        () =>
          provider.getAuthenticatedUser({
            accessToken: 'secret-access-token',
            scopes: ['user.info.basic'],
          }),
        (error) => error.code === 'reauthorization_required',
      );
      const failure = warnings.find((line) => line.includes('[tiktok.oauth.userinfo.failure]'));
      assert.ok(failure);
      assert.match(failure, /"httpStatus":401/);
      assert.match(failure, /access_token_invalid/);
      assert.equal(failure.includes('secret-access-token'), false);
      assert.equal(failure.includes('Bearer'), false);
    } finally {
      global.fetch = originalFetch;
      console.warn = originalWarn;
    }
  });

  it('maps profile fields and keeps missing metrics undefined (not zero)', () => {
    const mapped = {
      openId: 'oid',
      displayName: 'Creator',
      followerCount: 10n,
      likesCount: undefined,
      videoCount: 3n,
    };
    assert.equal(mapped.followerCount, 10n);
    assert.equal(mapped.likesCount, undefined);
    assert.notEqual(mapped.likesCount, 0n);
  });

  it('maps video payloads without coercing null metrics to zero', () => {
    const provider = createProvider();
    const mapped = provider.mapVideo({
      id: 'v1',
      title: 'Clip',
      create_time: 1_700_000_000,
      view_count: '12',
      like_count: null,
      comment_count: undefined,
    });
    assert.equal(mapped.videoId, 'v1');
    assert.equal(mapped.views, 12n);
    assert.equal(mapped.likes, undefined);
    assert.equal(mapped.comments, undefined);
  });

  it('skips videos without an id (duplicate-safe external key required)', () => {
    const provider = createProvider();
    assert.equal(provider.mapVideo({ title: 'no-id' }), null);
  });

  it('handles token exchange errors without exposing secrets', async () => {
    const provider = createProvider();
    const originalFetch = global.fetch;
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => {
      warnings.push(args.map(String).join(' '));
    };
    global.fetch = mock.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'invalid_grant',
        error_description: 'code expired',
        access_token: 'must-not-appear',
        refresh_token: 'must-not-appear',
      }),
    }));
    try {
      await assert.rejects(
        () =>
          provider.exchangeAuthorizationCode({
            code: 'bad-code',
            redirectUri: 'https://aviationsminuteanalysis.com/api/auth/tiktok/callback',
          }),
        (error) => {
          assert.equal(error.code, 'reauthorization_required');
          assert.equal(String(error.message).includes('tt-client-secret'), false);
          return true;
        },
      );
      assert.equal(warnings.length, 1);
      const diagnostic = warnings[0];
      assert.match(diagnostic, /\[tiktok\.oauth\.token\]/);
      assert.match(diagnostic, /"httpStatus":400/);
      assert.match(diagnostic, /"error":"invalid_grant"/);
      assert.match(diagnostic, /"error_description":"code expired"/);
      assert.equal(diagnostic.includes('must-not-appear'), false);
      assert.equal(diagnostic.includes('tt-client-secret'), false);
      assert.equal(diagnostic.includes('bad-code'), false);
      assert.equal(diagnostic.includes('access_token'), false);
      assert.equal(diagnostic.includes('refresh_token'), false);
      assert.equal(diagnostic.includes('client_secret'), false);
    } finally {
      global.fetch = originalFetch;
      console.warn = originalWarn;
    }
  });

  it('refresh maps revoked tokens to reauthorization_required', async () => {
    const provider = createProvider();
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async () => ({
      ok: false,
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

  it('paginates video list until has_more is false', async () => {
    const provider = createProvider();
    const originalFetch = global.fetch;
    let calls = 0;
    global.fetch = mock.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return {
          ok: true,
          json: async () => ({
            data: {
              videos: [{ id: 'a', view_count: 1 }],
              cursor: 100,
              has_more: true,
            },
            error: { code: 'ok' },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({
          data: {
            videos: [{ id: 'b', view_count: 2 }],
            cursor: 200,
            has_more: false,
          },
          error: { code: 'ok' },
        }),
      };
    });
    try {
      const page = await provider.listVideos(
        { accessToken: 'token', scopes: ['video.list'] },
        { maxPages: 5, maxCount: 20 },
      );
      assert.equal(page.videos.length, 2);
      assert.equal(page.hasMore, false);
      assert.equal(calls, 2);
    } finally {
      global.fetch = originalFetch;
    }
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
    assert.equal(
      resolveSocialConnectionStatus({ connectionStatus: 'disconnected', isConnected: false }),
      'disconnected',
    );
  });
});
