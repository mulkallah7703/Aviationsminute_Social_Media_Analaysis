import type { PrismaClient } from '@prisma/client';
import { OAuthFlowError, type TikTokPlatformProvider } from '@sma/providers';
import {
  calculateEngagementCount,
  type OAuthTokenSet,
  type TikTokUserSnapshot,
} from '@sma/types';
import { AccountMetricsRepository } from './repositories/account-metrics.repository';
import { MetricSnapshotRepository } from './repositories/metric-snapshot.repository';
import { SocialAccountRepository } from './repositories/social-account.repository';
import { SocialPostRepository } from './repositories/social-post.repository';
import { SyncJobRepository } from './repositories/sync-job.repository';
import { TokenLifecycleService } from './token-lifecycle';
import { PrismaTokenLifecycleStore } from './token-lifecycle.store';

export interface TikTokAccountSyncResult {
  status: 'completed' | 'failed' | 'reauthorization_required';
  recordsFetched: number;
  recordsInserted: number;
  recordsUpdated: number;
  errorMessage?: string;
}

export class TikTokAccountSync {
  private readonly accounts: SocialAccountRepository;
  private readonly accountMetrics: AccountMetricsRepository;
  private readonly snapshots: MetricSnapshotRepository;
  private readonly posts: SocialPostRepository;
  private readonly jobs: SyncJobRepository;
  private readonly tokens: TokenLifecycleService;

  constructor(
    prisma: PrismaClient,
    private readonly tiktok: TikTokPlatformProvider,
    encryptionKey: string,
  ) {
    this.accounts = new SocialAccountRepository(prisma);
    this.accountMetrics = new AccountMetricsRepository(prisma);
    this.snapshots = new MetricSnapshotRepository(prisma);
    this.posts = new SocialPostRepository(prisma);
    this.jobs = new SyncJobRepository(prisma);
    this.tokens = new TokenLifecycleService(new PrismaTokenLifecycleStore(prisma), encryptionKey);
  }

  async syncAccount(socialAccountId: bigint, syncJobId?: bigint): Promise<TikTokAccountSyncResult> {
    if (syncJobId) {
      await this.jobs.markRunning(syncJobId);
    }

    try {
      const account = await this.accounts.findByIdForSync(socialAccountId);
      if (!account) {
        throw new Error('Social account was not found.');
      }
      if (account.platforms.platformCode !== 'tiktok') {
        throw new Error('The account is not a TikTok account.');
      }
      if (account.connectionStatus === 'reauth_required') {
        throw new OAuthFlowError(
          'reauthorization_required',
          'TikTok access was revoked. Connect TikTok again.',
        );
      }
      if (!account.socialTokens) {
        throw new OAuthFlowError(
          'reauthorization_required',
          'TikTok tokens are missing. Connect TikTok again.',
        );
      }

      let tokens = await this.tokens.getValidTokenSet(account.socialAccountId, this.tiktok);
      const call = async <T>(operation: (current: OAuthTokenSet) => Promise<T>): Promise<T> => {
        try {
          return await operation(tokens);
        } catch (error) {
          if (!(error instanceof OAuthFlowError) || error.code !== 'reauthorization_required') {
            throw error;
          }
          tokens = await this.tokens.getValidTokenSet(account.socialAccountId, this.tiktok, {
            forceRefresh: true,
          });
          return operation(tokens);
        }
      };

      const user = await call((current) => this.tiktok.getAuthenticatedUser(current));
      if (!user) {
        throw new OAuthFlowError('no_tiktok_user', 'TikTok did not return a user profile.');
      }

      const videoPage = await call((current) =>
        this.tiktok.listVideos(current, { maxPages: 10, maxCount: 20 }),
      );

      await this.accounts.updateProfileCounts(account.socialAccountId, {
        username: null,
        displayName: user.displayName ?? null,
        profileImageUrl: user.avatarUrl ?? null,
        profileUrl: user.profileUrl ?? null,
        bio: user.bioDescription ?? null,
        countryCode: null,
        languageCode: null,
        subscribersCount: user.followerCount ?? null,
        totalViews: null,
        totalPosts: user.videoCount ?? null,
        publishedAt: null,
      });

      const accountMetricInput = this.toAccountMetricInput(user);
      await this.accountMetrics.upsertForAccount(account.socialAccountId, accountMetricInput);
      await this.snapshots.upsertDailySnapshot(account.socialAccountId, new Date(), accountMetricInput);

      let recordsUpdated = 0;
      for (const video of videoPage.videos) {
        await this.posts.upsertPostWithMetrics(account.socialAccountId, {
          platformPostId: video.videoId,
          postType: 'video',
          title: video.title ?? null,
          description: video.description ?? null,
          postUrl: video.embedLink ?? null,
          thumbnailUrl: video.coverImageUrl ?? null,
          mediaUrl: video.embedLink ?? null,
          publishedAt: video.publishedAt ?? null,
          viewsCount: video.views ?? null,
          likesCount: video.likes ?? null,
          commentsCount: video.comments ?? null,
          sharesCount: video.shares ?? null,
          savesCount: null,
          engagementCount: calculateEngagementCount(video.likes, video.comments, video.shares),
          watchTimeSeconds: null,
          subscribersGained: null,
          subscribersLost: null,
        });
        recordsUpdated += 1;
      }

      await this.accounts.updateLastSyncedAt(account.socialAccountId, new Date());

      const result: TikTokAccountSyncResult = {
        status: 'completed',
        recordsFetched: videoPage.videos.length + 1,
        recordsInserted: videoPage.videos.length,
        recordsUpdated,
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

  private toAccountMetricInput(user: TikTokUserSnapshot) {
    return {
      followersCount: user.followerCount ?? null,
      followingCount: user.followingCount ?? null,
      subscribersCount: user.followerCount ?? null,
      viewsCount: null,
      likesCount: user.likesCount ?? null,
      likesDelta: null,
      commentsCount: null,
      sharesCount: null,
      savesCount: null,
      reachCount: null,
      impressionsCount: null,
      watchTimeSeconds: null,
      subscribersGained: null,
      subscribersLost: null,
    };
  }

  private toSafeErrorMessage(error: unknown): string {
    if (error instanceof OAuthFlowError) {
      return error.message;
    }
    const message = error instanceof Error ? error.message : '';
    if (message) {
      return message
        .replace(/act\.[^\s]+/gi, '[redacted]')
        .replace(/rft\.[^\s]+/gi, '[redacted]')
        .slice(0, 500);
    }
    return 'Unable to synchronize TikTok analytics.';
  }
}
