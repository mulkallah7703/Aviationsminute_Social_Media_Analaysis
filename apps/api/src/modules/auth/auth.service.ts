import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { encryptSecret, parseApiEnv } from '@sma/config';
import {
  AccountMetricsRepository,
  PlatformRepository,
  SocialAccountRepository,
} from '@sma/database';
import {
  OAuthFlowError,
  ProviderCapabilityNotReadyError,
  createTikTokCodeChallenge,
  createTikTokCodeVerifier,
  type PlatformProviderRegistry,
  type TikTokPlatformProvider,
  type YouTubePlatformProvider,
} from '@sma/providers';
import {
  resolveSocialConnectionStatus,
  type OAuthErrorCode,
  type OAuthTokenSet,
  type TikTokUserSnapshot,
  type YoutubeChannelSnapshot,
} from '@sma/types';
import { PLATFORM_PROVIDER_REGISTRY } from '../../infrastructure/providers/providers.tokens';
import { CookieSessionService } from './cookie-session.service';
import { CurrentUserService } from './current-user.service';
import { SyncService } from '../sync/sync.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(PLATFORM_PROVIDER_REGISTRY)
    private readonly providers: PlatformProviderRegistry,
    private readonly currentUser: CurrentUserService,
    private readonly cookies: CookieSessionService,
    private readonly platforms: PlatformRepository,
    private readonly socialAccounts: SocialAccountRepository,
    private readonly accountMetrics: AccountMetricsRepository,
    private readonly syncService: SyncService,
  ) {}

  async startGoogleAuthorization(request: Request, response: Response): Promise<string> {
    try {
      const user = await this.currentUser.resolve(request, response);
      const env = parseApiEnv();
      const state = this.cookies.createOAuthState();
      this.cookies.setOAuthState(response, state);
      const youtubePlatform = await this.platforms.findByCode('youtube');
      const existing = youtubePlatform
        ? await this.socialAccounts.findByUserAndPlatform(user.userId, youtubePlatform.platformId)
        : null;
      const needsConsent =
        !existing?.socialTokens?.refreshTokenEncrypted ||
        resolveSocialConnectionStatus({
          connectionStatus: existing?.connectionStatus,
          isConnected: existing?.isConnected ?? false,
        }) === 'reauth_required';
      return await this.youtubeProvider().getAuthorizationUrl({
        state,
        redirectUri: env.GOOGLE_REDIRECT_URI,
        promptConsent: needsConsent,
      });
    } catch (error) {
      throw this.asOAuthFlowError(error, 'Failed to start Google authorization.');
    }
  }

  async completeGoogleCallback(
    request: Request,
    response: Response,
    query: { code?: string; state?: string; error?: string },
  ): Promise<{ status: 'connected' } | { status: 'error'; code: OAuthErrorCode }> {
    const env = parseApiEnv();

    try {
      if (query.error) {
        throw this.fromGoogleError(query.error);
      }
      if (!query.code) {
        throw new OAuthFlowError('missing_code', 'The authorization code is missing.');
      }
      if (!query.state) {
        throw new OAuthFlowError('missing_state', 'The OAuth state is missing.');
      }

      const expectedState = this.cookies.readOAuthState(request);
      if (!expectedState || expectedState !== query.state) {
        throw new OAuthFlowError('invalid_state', 'The OAuth state is invalid.');
      }

      const user = await this.resolveWorkspaceUser(request, response);
      const tokens = await this.youtubeProvider().exchangeAuthorizationCode({
        code: query.code,
        redirectUri: env.GOOGLE_REDIRECT_URI,
      });

      const channel = await this.youtubeProvider().getAuthenticatedChannel(tokens);
      if (!channel) {
        throw new OAuthFlowError(
          'no_youtube_channel',
          'This Google account does not have a YouTube channel.',
        );
      }

      const platform = await this.findYoutubePlatform();
      const account = await this.persistConnection(
        env.SOCIAL_TOKEN_ENCRYPTION_KEY,
        user.userId,
        platform.platformId,
        channel,
        tokens,
      );

      try {
        await this.syncService.enqueueYoutubeSync(account.socialAccountId, 'scheduled');
      } catch {
        this.logger.warn('YouTube connected, but the initial sync job could not be queued.');
      }

      this.logger.log('YouTube account connected.');
      return { status: 'connected' };
    } catch (error) {
      const code = this.toErrorCode(error);
      this.logger.warn(`YouTube OAuth callback failed: ${code}`);
      return { status: 'error', code };
    } finally {
      this.cookies.clearOAuthState(response);
    }
  }

  frontendRedirectUrl(
    result: { status: 'connected' } | { status: 'error'; code: OAuthErrorCode },
    path: '/youtube' | '/tiktok' = '/youtube',
  ): string {
    const env = parseApiEnv();
    if (result.status === 'connected') {
      return `${env.WEB_ORIGIN}${path}?status=connected`;
    }
    return `${env.WEB_ORIGIN}${path}?status=error&code=${encodeURIComponent(result.code)}`;
  }

  async startTikTokAuthorization(request: Request, response: Response): Promise<string> {
    try {
      const user = await this.currentUser.resolve(request, response);
      const env = parseApiEnv();
      if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET || !env.TIKTOK_REDIRECT_URI) {
        throw new OAuthFlowError('invalid_client', 'TikTok OAuth is not configured.');
      }
      const state = this.cookies.createOAuthState();
      const codeVerifier = createTikTokCodeVerifier();
      const codeChallenge = createTikTokCodeChallenge(codeVerifier);
      this.cookies.setOAuthState(response, state);
      this.cookies.setOAuthCodeVerifier(response, codeVerifier);
      const tiktokPlatform = await this.platforms.findByCode('tiktok');
      const existing = tiktokPlatform
        ? await this.socialAccounts.findByUserAndPlatform(user.userId, tiktokPlatform.platformId)
        : null;
      void existing;
      return await this.tiktokProvider().getAuthorizationUrl({
        state,
        redirectUri: env.TIKTOK_REDIRECT_URI,
        codeChallenge,
        codeChallengeMethod: 'S256',
      });
    } catch (error) {
      throw this.asOAuthFlowError(error, 'Failed to start TikTok authorization.');
    }
  }

  async completeTikTokCallback(
    request: Request,
    response: Response,
    query: { code?: string; state?: string; error?: string; error_description?: string },
  ): Promise<{ status: 'connected' } | { status: 'error'; code: OAuthErrorCode }> {
    const env = parseApiEnv();

    try {
      if (query.error) {
        throw this.fromTikTokError(query.error);
      }
      if (!query.code) {
        throw new OAuthFlowError('missing_code', 'The authorization code is missing.');
      }
      if (!query.state) {
        throw new OAuthFlowError('missing_state', 'The OAuth state is missing.');
      }

      const expectedState = this.cookies.readOAuthState(request);
      if (!expectedState || expectedState !== query.state) {
        throw new OAuthFlowError('invalid_state', 'The OAuth state is invalid.');
      }

      const codeVerifier = this.cookies.readOAuthCodeVerifier(request);
      if (!codeVerifier) {
        throw new OAuthFlowError(
          'invalid_state',
          'The OAuth PKCE verifier is missing. Try connecting again.',
        );
      }

      if (!env.TIKTOK_REDIRECT_URI) {
        throw new OAuthFlowError('invalid_client', 'TikTok OAuth is not configured.');
      }

      const user = await this.resolveWorkspaceUser(request, response);
      const tokens = await this.tiktokProvider().exchangeAuthorizationCode({
        code: query.code,
        redirectUri: env.TIKTOK_REDIRECT_URI,
        codeVerifier,
      });

      const profile = await this.tiktokProvider().getAuthenticatedUser(tokens);
      if (!profile) {
        throw new OAuthFlowError(
          'no_tiktok_user',
          'TikTok did not return a user profile for this authorization.',
        );
      }

      const platform = await this.findTikTokPlatform();
      const account = await this.persistTikTokConnection(
        env.SOCIAL_TOKEN_ENCRYPTION_KEY,
        user.userId,
        platform.platformId,
        profile,
        tokens,
      );

      try {
        await this.syncService.enqueueTikTokSync(account.socialAccountId, 'scheduled');
      } catch {
        this.logger.warn('TikTok connected, but the initial sync job could not be queued.');
      }

      this.logger.log('TikTok account connected.');
      return { status: 'connected' };
    } catch (error) {
      const code = this.toErrorCode(error);
      this.logger.warn(`TikTok OAuth callback failed: ${code}`);
      return { status: 'error', code };
    } finally {
      this.cookies.clearOAuthState(response);
    }
  }

  toPublicErrorCode(error: unknown): OAuthErrorCode {
    return this.toErrorCode(error);
  }

  private youtubeProvider(): YouTubePlatformProvider {
    return this.providers.get('youtube') as YouTubePlatformProvider;
  }

  private tiktokProvider(): TikTokPlatformProvider {
    return this.providers.get('tiktok') as TikTokPlatformProvider;
  }

  private async resolveWorkspaceUser(request: Request, response: Response) {
    try {
      return await this.currentUser.resolve(request, response);
    } catch (error) {
      throw this.asOAuthFlowError(error, 'Failed to resolve the workspace user.');
    }
  }

  private async findYoutubePlatform() {
    try {
      const platform = await this.platforms.findByCode('youtube');
      if (!platform) {
        throw new OAuthFlowError('database_failure', 'The YouTube platform record was not found.');
      }
      return platform;
    } catch (error) {
      throw this.asOAuthFlowError(error, 'Failed to load the YouTube platform record.');
    }
  }

  private async findTikTokPlatform() {
    try {
      const platform = await this.platforms.findByCode('tiktok');
      if (!platform) {
        throw new OAuthFlowError('database_failure', 'The TikTok platform record was not found.');
      }
      return platform;
    } catch (error) {
      throw this.asOAuthFlowError(error, 'Failed to load the TikTok platform record.');
    }
  }

  private async persistConnection(
    encryptionKey: string,
    userId: bigint,
    platformId: number,
    channel: YoutubeChannelSnapshot,
    tokens: OAuthTokenSet,
  ) {
    try {
      return await this.socialAccounts.upsertConnectedAccount({
        userId,
        platformId,
        platformAccountId: channel.channelId,
        username: channel.customUrl ?? null,
        displayName: channel.title,
        accountType: 'channel',
        profileImageUrl: channel.thumbnailUrl ?? null,
        profileUrl: channel.profileUrl,
        accessTokenEncrypted: encryptSecret(tokens.accessToken, encryptionKey),
        refreshTokenEncrypted: tokens.refreshToken
          ? encryptSecret(tokens.refreshToken, encryptionKey)
          : undefined,
        tokenType: tokens.tokenType ?? null,
        expiresAt: tokens.expiresAt ?? null,
        scope: tokens.scopes.join(' '),
        bio: channel.description ?? null,
        countryCode: channel.countryCode ?? null,
        languageCode: channel.languageCode ?? null,
        subscribersCount: channel.subscribersCount ?? null,
        totalViews: channel.totalViews ?? null,
        totalPosts: channel.videoCount ?? null,
        publishedAt: channel.publishedAt ?? null,
      });
    } catch (error) {
      throw this.asOAuthFlowError(error, 'Failed to persist the YouTube connection.');
    }
  }

  private async persistTikTokConnection(
    encryptionKey: string,
    userId: bigint,
    platformId: number,
    profile: TikTokUserSnapshot,
    tokens: OAuthTokenSet,
  ) {
    try {
      const openId = profile.openId || tokens.openId;
      if (!openId) {
        throw new OAuthFlowError('no_tiktok_user', 'TikTok open_id is missing.');
      }
      return await this.socialAccounts.upsertConnectedAccount({
        userId,
        platformId,
        platformAccountId: openId,
        username: null,
        displayName: profile.displayName ?? null,
        accountType: 'creator',
        profileImageUrl: profile.avatarUrl ?? null,
        profileUrl: profile.profileUrl ?? null,
        accessTokenEncrypted: encryptSecret(tokens.accessToken, encryptionKey),
        refreshTokenEncrypted: tokens.refreshToken
          ? encryptSecret(tokens.refreshToken, encryptionKey)
          : undefined,
        tokenType: tokens.tokenType ?? null,
        expiresAt: tokens.expiresAt ?? null,
        scope: tokens.scopes.join(','),
        bio: profile.bioDescription ?? null,
        countryCode: null,
        languageCode: null,
        subscribersCount: profile.followerCount ?? null,
        totalViews: null,
        totalPosts: profile.videoCount ?? null,
        publishedAt: null,
      }).then(async (account) => {
        await this.accountMetrics.upsertForAccount(account.socialAccountId, {
          followersCount: profile.followerCount ?? null,
          followingCount: profile.followingCount ?? null,
          subscribersCount: profile.followerCount ?? null,
          viewsCount: null,
          likesCount: profile.likesCount ?? null,
          likesDelta: null,
          commentsCount: null,
          sharesCount: null,
          savesCount: null,
          reachCount: null,
          impressionsCount: null,
          watchTimeSeconds: null,
          subscribersGained: null,
          subscribersLost: null,
        });
        return account;
      });
    } catch (error) {
      throw this.asOAuthFlowError(error, 'Failed to persist the TikTok connection.');
    }
  }

  private asOAuthFlowError(error: unknown, fallbackMessage: string): OAuthFlowError {
    if (error instanceof OAuthFlowError) {
      return error;
    }
    if (error instanceof ProviderCapabilityNotReadyError) {
      return new OAuthFlowError('invalid_client', 'OAuth is not configured.');
    }
    this.logger.warn(fallbackMessage);
    return new OAuthFlowError('database_failure', fallbackMessage);
  }

  private fromGoogleError(error: string): OAuthFlowError {
    if (error === 'access_denied') {
      return new OAuthFlowError('access_denied', 'YouTube authorization was denied.');
    }
    if (error === 'redirect_uri_mismatch') {
      return new OAuthFlowError('redirect_uri_mismatch', 'Redirect URI mismatch.');
    }
    return new OAuthFlowError('oauth_error', 'Google authorization failed.');
  }

  private fromTikTokError(error: string): OAuthFlowError {
    if (error === 'access_denied') {
      return new OAuthFlowError('access_denied', 'TikTok authorization was denied.');
    }
    if (error === 'redirect_uri_mismatch') {
      return new OAuthFlowError('redirect_uri_mismatch', 'TikTok redirect URI mismatch.');
    }
    return new OAuthFlowError('oauth_error', 'TikTok authorization failed.');
  }

  private toErrorCode(error: unknown): OAuthErrorCode {
    if (error instanceof OAuthFlowError) {
      return error.code;
    }
    if (error instanceof ProviderCapabilityNotReadyError) {
      return 'invalid_client';
    }
    this.logger.warn('Unexpected OAuth failure.');
    return 'oauth_error';
  }
}
