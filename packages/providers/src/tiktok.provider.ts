import { createHash, randomBytes } from 'node:crypto';
import { createLogger } from '@sma/config';
import type {
  NormalizedAccountMetrics,
  NormalizedPostMetrics,
  NormalizedPostPage,
  NormalizedSocialProfile,
  OAuthErrorCode,
  OAuthTokenSet,
  TikTokUserSnapshot,
  TikTokVideoSnapshot,
} from '@sma/types';
import { OAuthFlowError, ProviderCapabilityNotReadyError, TikTokApiError } from './errors';
import type {
  AuthorizationCodeExchange,
  AuthorizationRequest,
  ProviderSyncCursor,
  SocialPlatformProvider,
} from './social-platform-provider';
import type { TikTokProviderConfig } from './tiktok.config';

const AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';
const VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/';

const logger = createLogger({ name: 'tiktok-provider' });

/** RFC 7636 unreserved characters; TikTok Desktop requires 43–128 length. */
const PKCE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/**
 * TikTok Desktop / mobile PKCE helpers (hex SHA-256 challenge).
 * Kept for a future Desktop Login Kit path. Login Kit Web must not use them.
 */
export function createTikTokCodeVerifier(length = 64): string {
  const size = Math.min(128, Math.max(43, length));
  const bytes = randomBytes(size);
  let verifier = '';
  for (let i = 0; i < size; i += 1) {
    verifier += PKCE_ALPHABET[bytes[i]! % PKCE_ALPHABET.length];
  }
  return verifier;
}

export function createTikTokCodeChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier, 'utf8').digest('hex');
}

const USER_INFO_FIELDS = [
  'open_id',
  'union_id',
  'avatar_url',
  'display_name',
  'bio_description',
  'profile_deep_link',
  'is_verified',
  'follower_count',
  'following_count',
  'likes_count',
  'video_count',
].join(',');

const VIDEO_LIST_FIELDS = [
  'id',
  'title',
  'video_description',
  'duration',
  'cover_image_url',
  'embed_link',
  'create_time',
  'share_url',
  'like_count',
  'comment_count',
  'share_count',
  'view_count',
].join(',');

export type TikTokUserInfoOptions = {
  phase?: 'oauth_callback' | 'normal';
};

export interface TikTokPlatformProvider extends SocialPlatformProvider {
  getAuthenticatedUser(
    tokens: OAuthTokenSet,
    options?: TikTokUserInfoOptions,
  ): Promise<TikTokUserSnapshot | null>;
  listVideos(
    tokens: OAuthTokenSet,
    options?: { cursor?: number; maxCount?: number; maxPages?: number },
  ): Promise<{ videos: TikTokVideoSnapshot[]; cursor?: number; hasMore: boolean }>;
}

function parseOptionalBigInt(value: unknown): bigint | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return undefined;
  }
}

/** Maps TikTok OAuth token-endpoint errors to precise codes (Web Login Kit). */
export function mapTikTokOAuthError(payload: {
  error?: string;
  error_description?: string;
  message?: string;
  log_id?: string;
}): OAuthFlowError {
  const code = (payload.error ?? '').toLowerCase().trim();
  const description = (payload.error_description ?? payload.message ?? '').toLowerCase();

  if (code === 'access_denied') {
    return new OAuthFlowError('access_denied', 'TikTok authorization was denied.');
  }
  if (code === 'invalid_grant') {
    return new OAuthFlowError(
      'invalid_grant',
      'The TikTok authorization code was rejected or has expired. Try connecting again.',
    );
  }
  if (code === 'invalid_client') {
    return new OAuthFlowError('invalid_client', 'TikTok rejected the OAuth client configuration.');
  }
  if (code === 'invalid_request') {
    return new OAuthFlowError('invalid_request', 'The TikTok OAuth token request was invalid.');
  }
  if (code === 'invalid_scope') {
    return new OAuthFlowError('invalid_scope', 'The TikTok OAuth scopes are invalid or not approved.');
  }
  if (code === 'unauthorized_client') {
    return new OAuthFlowError(
      'unauthorized_client',
      'This TikTok client is not authorized for the requested grant.',
    );
  }
  if (
    code === 'redirect_uri_mismatch' ||
    code.includes('redirect') ||
    description.includes('redirect_uri')
  ) {
    return new OAuthFlowError(
      'redirect_uri_mismatch',
      'The TikTok redirect URI does not match the app configuration.',
    );
  }
  return new OAuthFlowError('token_exchange_failed', 'TikTok token exchange failed.');
}

function extractTikTokUserInfoFailure(
  status: number,
  body: unknown,
): {
  httpStatus: number;
  tikTokCode: string | null;
  tikTokMessage: string | null;
  errorDescription: string | null;
  logId: string | null;
  errorCode: string | number | null;
} {
  const payload =
    typeof body === 'object' && body !== null
      ? (body as {
          error?: string | { code?: string; message?: string };
          error_description?: string;
          error_code?: number | string;
          message?: string;
          log_id?: string;
        })
      : undefined;

  const nested =
    payload?.error && typeof payload.error === 'object' ? payload.error : undefined;
  const flatError = typeof payload?.error === 'string' ? payload.error : undefined;

  return {
    httpStatus: status,
    tikTokCode:
      typeof nested?.code === 'string'
        ? nested.code
        : typeof flatError === 'string'
          ? flatError
          : null,
    tikTokMessage:
      typeof nested?.message === 'string'
        ? nested.message
        : typeof payload?.message === 'string'
          ? payload.message
          : null,
    errorDescription:
      typeof payload?.error_description === 'string' ? payload.error_description : null,
    logId: typeof payload?.log_id === 'string' ? payload.log_id : null,
    errorCode:
      payload?.error_code !== undefined && payload?.error_code !== null
        ? payload.error_code
        : null,
  };
}

function classifyTikTokUserInfoFailure(
  httpStatus: number,
  tikTokCode: string | null,
): { oauthCode: OAuthErrorCode; publicMessage: string } {
  const code = (tikTokCode ?? '').toLowerCase();
  if (
    httpStatus === 401 ||
    code.includes('access_token') ||
    code.includes('unauthorized')
  ) {
    return {
      oauthCode: 'reauthorization_required',
      publicMessage: 'TikTok rejected the stored credentials. Connect TikTok again.',
    };
  }
  if (httpStatus === 429 || code.includes('rate_limit')) {
    return {
      oauthCode: 'quota_exceeded',
      publicMessage: 'The TikTok API rate limit was exceeded.',
    };
  }
  return {
    oauthCode: 'tiktok_api_error',
    publicMessage: 'TikTok User Info request failed.',
  };
}

function mapTikTokApiError(
  status: number,
  body: unknown,
  phase: 'oauth_callback' | 'normal' = 'normal',
): TikTokApiError {
  const details = extractTikTokUserInfoFailure(status, body);
  const classified = classifyTikTokUserInfoFailure(details.httpStatus, details.tikTokCode);

  logger.warn(
    {
      phase,
      httpStatus: details.httpStatus,
      tikTokCode: details.tikTokCode,
      tikTokMessage: details.tikTokMessage,
      errorDescription: details.errorDescription,
      logId: details.logId,
    },
    '[tiktok.userinfo.failure]',
  );

  return new TikTokApiError({
    oauthCode: classified.oauthCode,
    publicMessage: classified.publicMessage,
    httpStatus: details.httpStatus,
    tikTokCode: details.tikTokCode,
    tikTokMessage: details.tikTokMessage,
    errorDescription: details.errorDescription,
    logId: details.logId,
    errorCode: details.errorCode,
    phase,
  });
}

export class TikTokProvider implements TikTokPlatformProvider {
  readonly platformCode = 'tiktok' as const;
  readonly displayName = 'TikTok';
  readonly isImplemented: boolean;

  constructor(private readonly config?: TikTokProviderConfig) {
    this.isImplemented = Boolean(config?.clientKey && config.clientSecret && config.redirectUri);
  }

  /**
   * Login Kit Web authorize URL.
   * Uses configured redirectUri as the single source of truth (must match portal + token exchange).
   * PKCE params are omitted unless explicitly provided for a future Desktop flow.
   */
  getAuthorizationUrl(request: AuthorizationRequest): Promise<string> {
    const cfg = this.requireConfig();
    const redirectUri = cfg.redirectUri;
    const url = new URL(AUTH_URL);
    url.searchParams.set('client_key', cfg.clientKey);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', cfg.scopes.join(','));
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', request.state);
    // Desktop/mobile only — never set by the Web OAuth path.
    if (request.codeChallenge) {
      url.searchParams.set('code_challenge', request.codeChallenge);
      url.searchParams.set('code_challenge_method', request.codeChallengeMethod ?? 'S256');
    }
    return Promise.resolve(url.toString());
  }

  /**
   * Web confidential-client token exchange.
   * redirect_uri always comes from provider config (same value as authorize).
   * code_verifier is omitted unless explicitly provided for Desktop.
   */
  async exchangeAuthorizationCode(request: AuthorizationCodeExchange): Promise<OAuthTokenSet> {
    const cfg = this.requireConfig();
    const body = new URLSearchParams({
      client_key: cfg.clientKey,
      client_secret: cfg.clientSecret,
      code: request.code,
      grant_type: 'authorization_code',
      redirect_uri: cfg.redirectUri,
    });
    if (request.codeVerifier) {
      body.set('code_verifier', request.codeVerifier);
    }
    return this.requestToken(body);
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet> {
    const cfg = this.requireConfig();
    const body = new URLSearchParams({
      client_key: cfg.clientKey,
      client_secret: cfg.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
    try {
      return await this.requestToken(body);
    } catch (error) {
      // Refresh invalid_grant means the stored grant can no longer be used.
      if (
        error instanceof OAuthFlowError &&
        (error.code === 'invalid_grant' || error.code === 'unauthorized_client')
      ) {
        throw new OAuthFlowError(
          'reauthorization_required',
          'TikTok access was revoked. Connect TikTok again.',
        );
      }
      throw error;
    }
  }

  async getAuthenticatedUser(
    tokens: OAuthTokenSet,
    options?: TikTokUserInfoOptions,
  ): Promise<TikTokUserSnapshot | null> {
    const phase = options?.phase ?? 'normal';
    const url = new URL(USER_INFO_URL);
    url.searchParams.set('fields', USER_INFO_FIELDS);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });
    const json = (await response.json().catch(() => ({}))) as {
      data?: { user?: Record<string, unknown> };
      error?: string | { code?: string; message?: string };
      error_description?: string;
      error_code?: number | string;
      message?: string;
      log_id?: string;
    };

    const errorCode =
      typeof json.error === 'object' && json.error !== null ? json.error.code : undefined;
    if (!response.ok || (errorCode && errorCode !== 'ok')) {
      throw mapTikTokApiError(response.status, json, phase);
    }

    const user = json.data?.user;
    if (!user) {
      return null;
    }

    const openId = typeof user.open_id === 'string' ? user.open_id : tokens.openId;
    if (!openId) {
      return null;
    }

    return {
      openId,
      displayName: typeof user.display_name === 'string' ? user.display_name : undefined,
      avatarUrl: typeof user.avatar_url === 'string' ? user.avatar_url : undefined,
      profileUrl: typeof user.profile_deep_link === 'string' ? user.profile_deep_link : undefined,
      bioDescription: typeof user.bio_description === 'string' ? user.bio_description : undefined,
      followerCount: parseOptionalBigInt(user.follower_count),
      followingCount: parseOptionalBigInt(user.following_count),
      likesCount: parseOptionalBigInt(user.likes_count),
      videoCount: parseOptionalBigInt(user.video_count),
    };
  }

  async listVideos(
    tokens: OAuthTokenSet,
    options?: { cursor?: number; maxCount?: number; maxPages?: number },
  ): Promise<{ videos: TikTokVideoSnapshot[]; cursor?: number; hasMore: boolean }> {
    const maxPages = options?.maxPages ?? 5;
    const maxCount = Math.min(options?.maxCount ?? 20, 20);
    const videos: TikTokVideoSnapshot[] = [];
    let cursor = options?.cursor ?? 0;
    let hasMore = true;
    let pages = 0;

    while (hasMore && pages < maxPages) {
      const json = await this.authorizedJson<{
        data?: {
          videos?: Array<Record<string, unknown>>;
          cursor?: number;
          has_more?: boolean;
        };
      }>(tokens, `${VIDEO_LIST_URL}?fields=${encodeURIComponent(VIDEO_LIST_FIELDS)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_count: maxCount,
          cursor,
        }),
      });

      const pageVideos = json.data?.videos ?? [];
      for (const item of pageVideos) {
        const mapped = this.mapVideo(item);
        if (mapped) {
          videos.push(mapped);
        }
      }

      hasMore = Boolean(json.data?.has_more);
      cursor = typeof json.data?.cursor === 'number' ? json.data.cursor : cursor;
      pages += 1;
      if (!hasMore || pageVideos.length === 0) {
        break;
      }
    }

    return { videos, cursor: hasMore ? cursor : undefined, hasMore };
  }

  fetchProfile(tokens: OAuthTokenSet): Promise<NormalizedSocialProfile> {
    return this.getAuthenticatedUser(tokens).then((user) => {
      if (!user) {
        throw new OAuthFlowError('no_tiktok_user', 'TikTok did not return a user profile.');
      }
      return {
        platformUserId: user.openId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        profileUrl: user.profileUrl,
        description: user.bioDescription,
        subscribersCount: user.followerCount,
        totalPosts: user.videoCount,
        metadata: {
          followingCount: user.followingCount !== undefined ? Number(user.followingCount) : null,
          likesCount: user.likesCount !== undefined ? Number(user.likesCount) : null,
        },
      };
    });
  }

  async fetchPosts(tokens: OAuthTokenSet, cursor?: ProviderSyncCursor): Promise<NormalizedPostPage> {
    const page = await this.listVideos(tokens, {
      cursor: cursor?.value ? Number(cursor.value) : 0,
      maxPages: 1,
    });
    return {
      items: page.videos.map((video) => ({
        externalPostId: video.videoId,
        title: video.title,
        description: video.description,
        url: video.embedLink,
        contentType: 'video',
        publishedAt: video.publishedAt,
        thumbnailUrl: video.coverImageUrl,
      })),
      nextCursor: page.hasMore && page.cursor !== undefined ? String(page.cursor) : undefined,
    };
  }

  async fetchPostMetrics(tokens: OAuthTokenSet, externalPostId: string): Promise<NormalizedPostMetrics> {
    const page = await this.listVideos(tokens, { maxPages: 5 });
    const video = page.videos.find((item) => item.videoId === externalPostId);
    return {
      externalPostId,
      capturedAt: new Date(),
      metrics: {
        ...(video?.views !== undefined ? { views: Number(video.views) } : {}),
        ...(video?.likes !== undefined ? { likes: Number(video.likes) } : {}),
        ...(video?.comments !== undefined ? { comments: Number(video.comments) } : {}),
        ...(video?.shares !== undefined ? { shares: Number(video.shares) } : {}),
      },
    };
  }

  async fetchAccountMetrics(tokens: OAuthTokenSet): Promise<NormalizedAccountMetrics> {
    const user = await this.getAuthenticatedUser(tokens);
    return {
      capturedAt: new Date(),
      metrics: {
        ...(user?.followerCount !== undefined ? { followers: Number(user.followerCount) } : {}),
        ...(user?.followingCount !== undefined ? { following: Number(user.followingCount) } : {}),
        ...(user?.likesCount !== undefined ? { likes: Number(user.likesCount) } : {}),
        ...(user?.videoCount !== undefined ? { videos: Number(user.videoCount) } : {}),
      },
    };
  }

  mapVideo(item: Record<string, unknown>): TikTokVideoSnapshot | null {
    const videoId = typeof item.id === 'string' ? item.id : item.id != null ? String(item.id) : '';
    if (!videoId) {
      return null;
    }
    const createTime =
      typeof item.create_time === 'number'
        ? item.create_time
        : typeof item.create_time === 'string'
          ? Number(item.create_time)
          : undefined;
    const publishedAt =
      createTime && Number.isFinite(createTime) ? new Date(createTime * 1000) : undefined;

    return {
      videoId,
      title: typeof item.title === 'string' ? item.title : undefined,
      description: typeof item.video_description === 'string' ? item.video_description : undefined,
      durationSeconds: typeof item.duration === 'number' ? item.duration : undefined,
      coverImageUrl: typeof item.cover_image_url === 'string' ? item.cover_image_url : undefined,
      embedLink:
        typeof item.embed_link === 'string'
          ? item.embed_link
          : typeof item.share_url === 'string'
            ? item.share_url
            : undefined,
      publishedAt,
      views: parseOptionalBigInt(item.view_count),
      likes: parseOptionalBigInt(item.like_count),
      comments: parseOptionalBigInt(item.comment_count),
      shares: parseOptionalBigInt(item.share_count),
    };
  }

  private async requestToken(body: URLSearchParams): Promise<OAuthTokenSet> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body,
    });
    const json = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_expires_in?: number;
      open_id?: string;
      scope?: string;
      token_type?: string;
      error?: string;
      error_description?: string;
      message?: string;
      log_id?: string;
    };

    if (!response.ok || !json.access_token) {
      throw mapTikTokOAuthError({
        error: typeof json.error === 'string' ? json.error : undefined,
        error_description:
          typeof json.error_description === 'string' ? json.error_description : undefined,
        message: typeof json.message === 'string' ? json.message : undefined,
        log_id: typeof json.log_id === 'string' ? json.log_id : undefined,
      });
    }

    const expiresAt =
      typeof json.expires_in === 'number'
        ? new Date(Date.now() + json.expires_in * 1000)
        : undefined;

    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token || undefined,
      expiresAt,
      scopes: json.scope
        ? json.scope.split(/[,\s]+/).filter(Boolean)
        : this.requireConfig().scopes,
      tokenType: json.token_type ?? 'Bearer',
      openId: json.open_id,
    };
  }

  private async authorizedJson<T>(
    tokens: OAuthTokenSet,
    url: string,
    init: RequestInit,
  ): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        ...(init.headers ?? {}),
      },
    });
    const json = (await response.json().catch(() => ({}))) as T & {
      error?: { code?: string; message?: string };
    };
    if (!response.ok) {
      throw mapTikTokApiError(response.status, json);
    }
    const errorCode = json.error?.code;
    if (errorCode && errorCode !== 'ok') {
      throw mapTikTokApiError(response.status || 400, json);
    }
    return json;
  }

  private requireConfig(): TikTokProviderConfig {
    if (!this.config?.clientKey || !this.config.clientSecret || !this.config.redirectUri) {
      throw new ProviderCapabilityNotReadyError('tiktok', 'oauth');
    }
    return this.config;
  }
}
