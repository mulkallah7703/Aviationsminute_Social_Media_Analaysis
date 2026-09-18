import { google } from 'googleapis';
import type {
  NormalizedAccountMetrics,
  NormalizedPostMetrics,
  NormalizedPostPage,
  NormalizedSocialProfile,
  OAuthTokenSet,
  YoutubeAnalyticsRange,
  YoutubeChannelAnalytics,
  YoutubeChannelSnapshot,
  YoutubeVideoSnapshot,
} from '@sma/types';
import { defaultYoutubeAnalyticsRange, minutesToWatchTimeSeconds } from '@sma/types';
import { OAuthFlowError, ProviderCapabilityNotReadyError } from './errors';
import type {
  AuthorizationCodeExchange,
  AuthorizationRequest,
  ProviderSyncCursor,
  SocialPlatformProvider,
} from './social-platform-provider';
import type { YouTubeProviderConfig } from './youtube.config';
import { queryChannelAnalytics, queryVideoAnalyticsByVideoId } from './youtube-reports';

export interface YouTubePlatformProvider extends SocialPlatformProvider {
  getAuthenticatedChannel(tokens: OAuthTokenSet): Promise<YoutubeChannelSnapshot | null>;
  getChannelProfile(tokens: OAuthTokenSet): Promise<YoutubeChannelSnapshot | null>;
  getChannelMetrics(tokens: OAuthTokenSet): Promise<NormalizedAccountMetrics>;
  getChannelAnalytics(
    tokens: OAuthTokenSet,
    range?: YoutubeAnalyticsRange,
    channel?: YoutubeChannelSnapshot | null,
  ): Promise<YoutubeChannelAnalytics>;
  getVideos(tokens: OAuthTokenSet, cursor?: ProviderSyncCursor): Promise<NormalizedPostPage>;
  listChannelVideos(
    tokens: OAuthTokenSet,
    options?: { pageToken?: string; maxPages?: number; channel?: YoutubeChannelSnapshot | null },
  ): Promise<{ videos: YoutubeVideoSnapshot[]; nextPageToken?: string }>;
  getVideoMetrics(tokens: OAuthTokenSet, externalPostId: string): Promise<NormalizedPostMetrics>;
}

function parseOptionalBigInt(value: string | null | undefined): bigint | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

function mapGoogleOAuthError(error: unknown): OAuthFlowError {
  const payload =
    typeof error === 'object' && error !== null
      ? (error as {
          message?: string;
          response?: { data?: { error?: string; error_description?: string } };
        })
      : undefined;
  const googleError = payload?.response?.data?.error ?? payload?.message ?? '';
  const normalized = googleError.toLowerCase();

  if (normalized.includes('invalid_grant')) {
    return new OAuthFlowError('invalid_grant', 'The authorization code is invalid or has expired.');
  }
  if (normalized.includes('invalid_client')) {
    return new OAuthFlowError('invalid_client', 'Google rejected the OAuth client configuration.');
  }
  if (normalized.includes('redirect_uri_mismatch')) {
    return new OAuthFlowError(
      'redirect_uri_mismatch',
      'The redirect URI does not match the Google Cloud client configuration.',
    );
  }

  return new OAuthFlowError('token_exchange_failed', 'Google token exchange failed.');
}

function mapYouTubeApiError(error: unknown): OAuthFlowError {
  const payload =
    typeof error === 'object' && error !== null
      ? (error as {
          code?: number;
          message?: string;
          errors?: Array<{ reason?: string }>;
          response?: { status?: number; data?: { error?: { errors?: Array<{ reason?: string }> } } };
        })
      : undefined;

  const reasons = [
    ...(payload?.errors ?? []),
    ...(payload?.response?.data?.error?.errors ?? []),
  ]
    .map((item) => item.reason ?? '')
    .join(' ')
    .toLowerCase();
  const status = payload?.code ?? payload?.response?.status;

  if (reasons.includes('quotaexceeded') || status === 429) {
    return new OAuthFlowError('quota_exceeded', 'The YouTube API quota was exceeded. Try again later.');
  }
  if (status === 401 || reasons.includes('autherror') || reasons.includes('invalidcredentials')) {
    return new OAuthFlowError(
      'reauthorization_required',
      'YouTube rejected the stored credentials. Connect YouTube again.',
    );
  }
  if (status === 403 && (reasons.includes('insufficientpermissions') || reasons.includes('forbidden'))) {
    return new OAuthFlowError(
      'reauthorization_required',
      'YouTube permission is missing. Connect YouTube again.',
    );
  }

  return new OAuthFlowError('youtube_api_error', 'YouTube could not complete the request.');
}

export class YouTubeProvider implements YouTubePlatformProvider {
  readonly platformCode = 'youtube' as const;
  readonly displayName = 'YouTube';
  readonly isImplemented: boolean;

  constructor(private readonly config?: YouTubeProviderConfig) {
    this.isImplemented = Boolean(config?.clientId && config.clientSecret);
  }

  getAuthorizationUrl(request: AuthorizationRequest): Promise<string> {
    const client = this.createOAuthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      include_granted_scopes: true,
      scope: this.requireConfig().scopes,
      state: request.state,
      redirect_uri: request.redirectUri,
      ...(request.promptConsent ? { prompt: 'consent' } : {}),
    });
    return Promise.resolve(url);
  }

  async exchangeAuthorizationCode(request: AuthorizationCodeExchange): Promise<OAuthTokenSet> {
    const client = this.createOAuthClient();
    try {
      const { tokens } = await client.getToken({
        code: request.code,
        redirect_uri: request.redirectUri,
      });

      if (!tokens.access_token) {
        throw new OAuthFlowError('token_exchange_failed', 'Google did not return an access token.');
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        scopes: tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : this.requireConfig().scopes,
        tokenType: tokens.token_type ?? undefined,
      };
    } catch (error) {
      if (error instanceof OAuthFlowError) {
        throw error;
      }
      throw mapGoogleOAuthError(error);
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet> {
    const client = this.createOAuthClient();
    client.setCredentials({ refresh_token: refreshToken });
    try {
      const { credentials } = await client.refreshAccessToken();
      if (!credentials.access_token) {
        throw new OAuthFlowError('token_exchange_failed', 'Google did not return a refreshed access token.');
      }
      return {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token ?? undefined,
        expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        scopes: credentials.scope
          ? credentials.scope.split(/\s+/).filter(Boolean)
          : this.requireConfig().scopes,
        tokenType: credentials.token_type ?? undefined,
      };
    } catch (error) {
      if (error instanceof OAuthFlowError) {
        throw error;
      }
      const mapped = mapGoogleOAuthError(error);
      if (mapped.code === 'invalid_grant') {
        throw new OAuthFlowError(
          'reauthorization_required',
          'YouTube access was revoked. Connect YouTube again.',
        );
      }
      throw mapped;
    }
  }

  async getAuthenticatedChannel(tokens: OAuthTokenSet): Promise<YoutubeChannelSnapshot | null> {
    const auth = this.createOAuthClient();
    auth.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiresAt?.getTime(),
      token_type: tokens.tokenType,
      scope: tokens.scopes.join(' '),
    });

    try {
      const youtube = google.youtube({ version: 'v3', auth });
      const response = await youtube.channels.list({
        mine: true,
        part: ['snippet', 'statistics', 'status', 'brandingSettings', 'contentDetails'],
      });

      const channel = response.data.items?.[0];
      if (!channel?.id) {
        return null;
      }

      const snippet = channel.snippet;
      const statistics = channel.statistics;
      const handle = snippet?.customUrl?.replace(/^@/, '') || undefined;
      const thumbnail =
        snippet?.thumbnails?.high?.url ??
        snippet?.thumbnails?.medium?.url ??
        snippet?.thumbnails?.default?.url ??
        undefined;

      const subscribersHidden = statistics?.hiddenSubscriberCount === true;
      const profileUrl = handle
        ? `https://www.youtube.com/@${handle}`
        : `https://www.youtube.com/channel/${channel.id}`;

      return {
        channelId: channel.id,
        title: snippet?.title ?? 'YouTube channel',
        description: snippet?.description || undefined,
        customUrl: handle,
        thumbnailUrl: thumbnail,
        profileUrl,
        countryCode: snippet?.country || undefined,
        languageCode: snippet?.defaultLanguage || undefined,
        publishedAt: snippet?.publishedAt ? new Date(snippet.publishedAt) : undefined,
        subscribersCount: subscribersHidden
          ? undefined
          : parseOptionalBigInt(statistics?.subscriberCount ?? undefined),
        totalViews: parseOptionalBigInt(statistics?.viewCount ?? undefined),
        videoCount: parseOptionalBigInt(statistics?.videoCount ?? undefined),
        uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || undefined,
      };
    } catch (error) {
      if (error instanceof OAuthFlowError) {
        throw error;
      }
      throw mapYouTubeApiError(error);
    }
  }

  getChannelProfile(tokens: OAuthTokenSet): Promise<YoutubeChannelSnapshot | null> {
    return this.getAuthenticatedChannel(tokens);
  }

  async getChannelMetrics(tokens: OAuthTokenSet): Promise<NormalizedAccountMetrics> {
    const channel = await this.getAuthenticatedChannel(tokens);
    const metrics: Record<string, number> = {};
    if (channel?.subscribersCount !== undefined) {
      metrics.subscribers = Number(channel.subscribersCount);
    }
    if (channel?.totalViews !== undefined) {
      metrics.views = Number(channel.totalViews);
    }
    if (channel?.videoCount !== undefined) {
      metrics.videos = Number(channel.videoCount);
    }
    return {
      capturedAt: new Date(),
      metrics,
    };
  }

  async getChannelAnalytics(
    tokens: OAuthTokenSet,
    range: YoutubeAnalyticsRange = defaultYoutubeAnalyticsRange(),
    channel?: YoutubeChannelSnapshot | null,
  ): Promise<YoutubeChannelAnalytics> {
    const resolved = channel ?? (await this.getAuthenticatedChannel(tokens));
    if (!resolved) {
      throw new OAuthFlowError('no_youtube_channel', 'The Google account has no YouTube channel.');
    }
    const auth = this.createAuthorizedClient(tokens);
    const youtubeAnalytics = google.youtubeAnalytics({ version: 'v2', auth });
    return queryChannelAnalytics(youtubeAnalytics, resolved.channelId, range);
  }

  async getVideos(
    tokens: OAuthTokenSet,
    cursor?: ProviderSyncCursor,
  ): Promise<NormalizedPostPage> {
    const page = await this.listChannelVideos(tokens, { pageToken: cursor?.value, maxPages: 1 });
    return {
      items: page.videos.map((video) => ({
        externalPostId: video.videoId,
        title: video.title,
        description: video.description,
        url: video.url,
        contentType: 'video',
        publishedAt: video.publishedAt,
        thumbnailUrl: video.thumbnailUrl,
      })),
      nextCursor: page.nextPageToken,
    };
  }

  async listChannelVideos(
    tokens: OAuthTokenSet,
    options?: { pageToken?: string; maxPages?: number; channel?: YoutubeChannelSnapshot | null },
  ): Promise<{ videos: YoutubeVideoSnapshot[]; nextPageToken?: string }> {
    try {
      const channel = options?.channel ?? (await this.getAuthenticatedChannel(tokens));
      if (!channel) {
        throw new OAuthFlowError('no_youtube_channel', 'The Google account has no YouTube channel.');
      }
      if (!channel.uploadsPlaylistId) {
        return { videos: [] };
      }

      const auth = this.createAuthorizedClient(tokens);
      const youtube = google.youtube({ version: 'v3', auth });
      const maxPages = Math.min(Math.max(options?.maxPages ?? 2, 1), 4);
      const videos: YoutubeVideoSnapshot[] = [];
      let pageToken = options?.pageToken;
      let nextPageToken: string | undefined;

      for (let page = 0; page < maxPages; page += 1) {
        const playlist = await youtube.playlistItems.list({
          playlistId: channel.uploadsPlaylistId,
          part: ['contentDetails', 'snippet'],
          maxResults: 50,
          pageToken,
        });

        const videoIds = (playlist.data.items ?? [])
          .map((item) => item.contentDetails?.videoId)
          .filter((id): id is string => Boolean(id));

        if (videoIds.length > 0) {
          const details = await youtube.videos.list({
            id: videoIds,
            part: ['snippet', 'statistics', 'contentDetails'],
          });

          for (const item of details.data.items ?? []) {
            if (!item.id) {
              continue;
            }
            const snippet = item.snippet;
            const statistics = item.statistics;
            const thumbnail =
              snippet?.thumbnails?.high?.url ??
              snippet?.thumbnails?.medium?.url ??
              snippet?.thumbnails?.default?.url ??
              undefined;
            videos.push({
              videoId: item.id,
              title: snippet?.title || undefined,
              description: snippet?.description || undefined,
              publishedAt: snippet?.publishedAt ? new Date(snippet.publishedAt) : undefined,
              thumbnailUrl: thumbnail,
              url: `https://www.youtube.com/watch?v=${item.id}`,
              views: parseOptionalBigInt(statistics?.viewCount ?? undefined),
              likes: parseOptionalBigInt(statistics?.likeCount ?? undefined),
              comments: parseOptionalBigInt(statistics?.commentCount ?? undefined),
            });
          }
        }

        nextPageToken = playlist.data.nextPageToken ?? undefined;
        if (!nextPageToken) {
          break;
        }
        pageToken = nextPageToken;
      }

      try {
        const analytics = await queryVideoAnalyticsByVideoId(
          google.youtubeAnalytics({ version: 'v2', auth }),
          channel.channelId,
          defaultYoutubeAnalyticsRange(),
        );
        for (const video of videos) {
          const extra = analytics.get(video.videoId);
          if (!extra) {
            continue;
          }
          video.shares = extra.shares;
          video.watchTimeSeconds = minutesToWatchTimeSeconds(extra.estimatedMinutesWatched) ?? undefined;
          video.subscribersGained = extra.subscribersGained;
        }
      } catch (error) {
        if (
          error instanceof OAuthFlowError &&
          (error.code === 'quota_exceeded' || error.code === 'reauthorization_required')
        ) {
          throw error;
        }
      }

      return { videos, nextPageToken };
    } catch (error) {
      if (error instanceof OAuthFlowError) {
        throw error;
      }
      throw mapYouTubeApiError(error);
    }
  }

  async getVideoMetrics(tokens: OAuthTokenSet, externalPostId: string): Promise<NormalizedPostMetrics> {
    const page = await this.listChannelVideos(tokens, { maxPages: 1 });
    const video = page.videos.find((item) => item.videoId === externalPostId);
    const metrics: Record<string, number> = {};
    if (video?.views !== undefined) {
      metrics.views = Number(video.views);
    }
    if (video?.likes !== undefined) {
      metrics.likes = Number(video.likes);
    }
    if (video?.comments !== undefined) {
      metrics.comments = Number(video.comments);
    }
    if (video?.shares !== undefined) {
      metrics.shares = Number(video.shares);
    }
    return {
      externalPostId,
      capturedAt: new Date(),
      metrics,
    };
  }

  async fetchProfile(tokens: OAuthTokenSet): Promise<NormalizedSocialProfile> {
    const channel = await this.getAuthenticatedChannel(tokens);
    if (!channel) {
      throw new OAuthFlowError('no_youtube_channel', 'The Google account has no YouTube channel.');
    }

    return {
      platformUserId: channel.channelId,
      handle: channel.customUrl,
      displayName: channel.title,
      avatarUrl: channel.thumbnailUrl,
      profileUrl: channel.profileUrl,
      description: channel.description,
      countryCode: channel.countryCode,
      languageCode: channel.languageCode,
      publishedAt: channel.publishedAt,
      subscribersCount: channel.subscribersCount,
      totalViews: channel.totalViews,
      totalPosts: channel.videoCount,
    };
  }

  fetchPosts(tokens: OAuthTokenSet, cursor?: ProviderSyncCursor): Promise<NormalizedPostPage> {
    return this.getVideos(tokens, cursor);
  }

  fetchPostMetrics(tokens: OAuthTokenSet, externalPostId: string): Promise<NormalizedPostMetrics> {
    return this.getVideoMetrics(tokens, externalPostId);
  }

  async fetchAccountMetrics(tokens: OAuthTokenSet): Promise<NormalizedAccountMetrics> {
    return this.getChannelMetrics(tokens);
  }

  private requireConfig(): YouTubeProviderConfig {
    if (!this.config?.clientId || !this.config.clientSecret) {
      throw new ProviderCapabilityNotReadyError('youtube', 'oauth');
    }
    return this.config;
  }

  private createAuthorizedClient(tokens: OAuthTokenSet) {
    const auth = this.createOAuthClient();
    auth.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiresAt?.getTime(),
      token_type: tokens.tokenType,
      scope: tokens.scopes.join(' '),
    });
    return auth;
  }

  private createOAuthClient() {
    const config = this.requireConfig();
    return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
  }
}
