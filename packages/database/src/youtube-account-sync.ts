import type { PrismaClient } from '@prisma/client';
import { OAuthFlowError, type YouTubePlatformProvider } from '@sma/providers';
import {
  calculateEngagementCount,
  defaultYoutubeAnalyticsRange,
  minutesToWatchTimeSeconds,
  type OAuthTokenSet,
  type YoutubeChannelAnalytics,
} from '@sma/types';
import { AccountMetricsRepository } from './repositories/account-metrics.repository';
import { MetricSnapshotRepository } from './repositories/metric-snapshot.repository';
import { SocialAccountRepository } from './repositories/social-account.repository';
import { SocialPostRepository } from './repositories/social-post.repository';
import { SyncJobRepository } from './repositories/sync-job.repository';
import { TokenLifecycleService } from './token-lifecycle';
import { PrismaTokenLifecycleStore } from './token-lifecycle.store';

export interface YoutubeAccountSyncResult {
  status: 'completed' | 'failed' | 'reauthorization_required';
  recordsFetched: number;
  recordsInserted: number;
  recordsUpdated: number;
  errorMessage?: string;
  warning?: string;
}

export class YoutubeAccountSync {
  private readonly accounts: SocialAccountRepository;
  private readonly accountMetrics: AccountMetricsRepository;
  private readonly snapshots: MetricSnapshotRepository;
  private readonly posts: SocialPostRepository;
  private readonly jobs: SyncJobRepository;
  private readonly tokens: TokenLifecycleService;

  constructor(
    prisma: PrismaClient,
    private readonly youtube: YouTubePlatformProvider,
    encryptionKey: string,
  ) {
    this.accounts = new SocialAccountRepository(prisma);
    this.accountMetrics = new AccountMetricsRepository(prisma);
    this.snapshots = new MetricSnapshotRepository(prisma);
    this.posts = new SocialPostRepository(prisma);
    this.jobs = new SyncJobRepository(prisma);
    this.tokens = new TokenLifecycleService(new PrismaTokenLifecycleStore(prisma), encryptionKey);
  }

  async syncAccount(socialAccountId: bigint, syncJobId?: bigint): Promise<YoutubeAccountSyncResult> {
    if (syncJobId) {
      await this.jobs.markRunning(syncJobId);
    }

    try {
      const account = await this.accounts.findByIdForSync(socialAccountId);
      if (!account) {
        throw new Error('Social account was not found.');
      }
      if (account.platforms.platformCode !== 'youtube') {
        throw new Error('The account is not a YouTube account.');
      }
      if (account.connectionStatus === 'reauth_required') {
        throw new OAuthFlowError(
          'reauthorization_required',
          'YouTube access was revoked. Connect YouTube again.',
        );
      }
      if (!account.socialTokens) {
        throw new OAuthFlowError(
          'reauthorization_required',
          'YouTube tokens are missing. Connect YouTube again.',
        );
      }

      let tokens = await this.tokens.getValidTokenSet(account.socialAccountId, this.youtube);
      const call = async <T>(operation: (current: OAuthTokenSet) => Promise<T>): Promise<T> => {
        try {
          return await operation(tokens);
        } catch (error) {
          if (!(error instanceof OAuthFlowError) || error.code !== 'reauthorization_required') {
            throw error;
          }
          tokens = await this.tokens.getValidTokenSet(account.socialAccountId, this.youtube, {
            forceRefresh: true,
          });
          return operation(tokens);
        }
      };

      const channel = await call((current) => this.youtube.getAuthenticatedChannel(current));
      if (!channel) {
        throw new OAuthFlowError('no_youtube_channel', 'The Google account has no YouTube channel.');
      }

      let analytics: YoutubeChannelAnalytics = { range: defaultYoutubeAnalyticsRange() };
      let analyticsWarning: string | undefined;
      try {
        analytics = await call((current) =>
          this.youtube.getChannelAnalytics(current, undefined, channel),
        );
      } catch (error) {
        if (
          error instanceof OAuthFlowError &&
          (error.code === 'reauthorization_required' || error.code === 'quota_exceeded')
        ) {
          throw error;
        }
        analyticsWarning = this.toSafeErrorMessage(error);
      }

      const videoPage = await call((current) =>
        this.youtube.listChannelVideos(current, { maxPages: 2, channel }),
      );

      await this.accounts.updateProfileCounts(account.socialAccountId, {
        username: channel.customUrl ?? null,
        displayName: channel.title,
        profileImageUrl: channel.thumbnailUrl ?? null,
        profileUrl: channel.profileUrl,
        bio: channel.description ?? null,
        countryCode: channel.countryCode ?? null,
        languageCode: channel.languageCode ?? null,
        subscribersCount: channel.subscribersCount ?? null,
        totalViews: channel.totalViews ?? null,
        totalPosts: channel.videoCount ?? null,
        publishedAt: channel.publishedAt ?? null,
      });

      const accountMetricInput = this.toAccountMetricInput(channel.subscribersCount, analytics);
      await this.accountMetrics.upsertForAccount(account.socialAccountId, accountMetricInput);
      await this.snapshots.upsertDailySnapshot(account.socialAccountId, new Date(), accountMetricInput);

      let recordsUpdated = 0;
      for (const video of videoPage.videos) {
        await this.posts.upsertPostWithMetrics(account.socialAccountId, {
          platformPostId: video.videoId,
          postType: 'video',
          title: video.title ?? null,
          description: video.description ?? null,
          postUrl: video.url,
          thumbnailUrl: video.thumbnailUrl ?? null,
          mediaUrl: video.url,
          publishedAt: video.publishedAt ?? null,
          viewsCount: video.views ?? null,
          likesCount: video.likes ?? null,
          commentsCount: video.comments ?? null,
          sharesCount: video.shares ?? null,
          savesCount: null,
          engagementCount: calculateEngagementCount(video.likes, video.comments, video.shares),
          watchTimeSeconds: video.watchTimeSeconds ?? null,
          subscribersGained: video.subscribersGained ?? null,
          subscribersLost: video.subscribersLost ?? null,
        });
        recordsUpdated += 1;
      }

      const now = new Date();
      await this.accounts.updateLastSyncedAt(account.socialAccountId, now);

      const result: YoutubeAccountSyncResult = {
        status: 'completed',
        recordsFetched: videoPage.videos.length + 1,
        recordsInserted: videoPage.videos.length,
        recordsUpdated,
        warning: analyticsWarning,
      };

      if (syncJobId) {
        await this.jobs.markCompleted(syncJobId, result);
      }
      return result;
    } catch (error) {
      const reauth = error instanceof OAuthFlowError && error.code === 'reauthorization_required';
      if (reauth) {
        await this.accounts.markReauthorizationRequired(socialAccountId);
      }
      const errorMessage = this.toSafeErrorMessage(error);
      if (syncJobId) {
        await this.jobs.markFailed(syncJobId, errorMessage);
      }
      return {
        status: reauth ? 'reauthorization_required' : 'failed',
        recordsFetched: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        errorMessage,
      };
    }
  }

  async fetchChannelAnalytics(
    socialAccountId: bigint,
    range: { startDate: string; endDate: string },
  ): Promise<YoutubeChannelAnalytics> {
    const account = await this.accounts.findByIdForSync(socialAccountId);
    if (!account) {
      throw new Error('Social account was not found.');
    }
    if (account.platforms.platformCode !== 'youtube') {
      throw new Error('The account is not a YouTube account.');
    }
    if (account.connectionStatus === 'reauth_required') {
      throw new OAuthFlowError(
        'reauthorization_required',
        'YouTube access was revoked. Connect YouTube again.',
      );
    }
    if (!account.socialTokens) {
      throw new OAuthFlowError(
        'reauthorization_required',
        'YouTube tokens are missing. Connect YouTube again.',
      );
    }

    let tokens = await this.tokens.getValidTokenSet(account.socialAccountId, this.youtube);
    const call = async <T>(operation: (current: OAuthTokenSet) => Promise<T>): Promise<T> => {
      try {
        return await operation(tokens);
      } catch (error) {
        if (!(error instanceof OAuthFlowError) || error.code !== 'reauthorization_required') {
          throw error;
        }
        tokens = await this.tokens.getValidTokenSet(account.socialAccountId, this.youtube, {
          forceRefresh: true,
        });
        return operation(tokens);
      }
    };

    const channel = await call((current) => this.youtube.getAuthenticatedChannel(current));
    if (!channel) {
      throw new OAuthFlowError('no_youtube_channel', 'The Google account has no YouTube channel.');
    }
    return call((current) => this.youtube.getChannelAnalytics(current, range, channel));
  }

  private toAccountMetricInput(
    subscribersCount: bigint | undefined,
    analytics: YoutubeChannelAnalytics,
  ) {
    return {
      followersCount: null,
      followingCount: null,
      subscribersCount: subscribersCount ?? null,
      viewsCount: analytics.views ?? null,
      likesDelta: analytics.likes ?? null,
      commentsCount: analytics.comments ?? null,
      sharesCount: analytics.shares ?? null,
      savesCount: null,
      reachCount: null,
      impressionsCount: null,
      watchTimeSeconds: minutesToWatchTimeSeconds(analytics.estimatedMinutesWatched),
      subscribersGained: analytics.subscribersGained ?? null,
      subscribersLost: analytics.subscribersLost ?? null,
    };
  }

  private toSafeErrorMessage(error: unknown): string {
    if (error instanceof OAuthFlowError) {
      return error.message;
    }
    const message = error instanceof Error ? error.message : '';
    if (message.includes('CK_AccountMetrics_NonNegative')) {
      return 'Account metrics include a negative count that the database contract does not allow.';
    }
    if (message.includes('CK_PostMetrics_NonNegative')) {
      return 'Post metrics include a negative count that the database contract does not allow.';
    }
    if (message) {
      return message.replace(/ya29\.[^\s]+/gi, '[redacted]').replace(/1\/\/[^\s]+/g, '[redacted]').slice(0, 500);
    }
    return 'Unable to synchronize YouTube analytics.';
  }
}
