import type {
  NormalizedAccountMetrics,
  NormalizedPostMetrics,
  NormalizedPostPage,
  NormalizedSocialProfile,
  OAuthTokenSet,
  PlatformCode,
} from '@sma/types';

export interface AuthorizationRequest {
  state: string;
  redirectUri: string;
  promptConsent?: boolean;
  /** TikTok PKCE (S256). Challenge only — never put the verifier in the authorize URL. */
  codeChallenge?: string;
  codeChallengeMethod?: 'S256';
}

export interface AuthorizationCodeExchange {
  code: string;
  redirectUri: string;
  /** TikTok PKCE verifier paired with the authorize-time challenge. */
  codeVerifier?: string;
}

export interface ProviderSyncCursor {
  value?: string;
}

export interface SocialPlatformProvider {
  readonly platformCode: PlatformCode;
  readonly displayName: string;
  readonly isImplemented: boolean;

  getAuthorizationUrl(request: AuthorizationRequest): Promise<string>;
  exchangeAuthorizationCode(request: AuthorizationCodeExchange): Promise<OAuthTokenSet>;
  refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet>;
  fetchProfile(tokens: OAuthTokenSet): Promise<NormalizedSocialProfile>;
  fetchPosts(tokens: OAuthTokenSet, cursor?: ProviderSyncCursor): Promise<NormalizedPostPage>;
  fetchPostMetrics(tokens: OAuthTokenSet, externalPostId: string): Promise<NormalizedPostMetrics>;
  fetchAccountMetrics(tokens: OAuthTokenSet): Promise<NormalizedAccountMetrics>;
}
