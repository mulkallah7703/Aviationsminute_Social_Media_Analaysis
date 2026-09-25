import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AccountMetricsRepository,
  PlatformRepository,
  SocialAccountRepository,
  SocialPostRepository,
  SyncJobRepository,
} from '@sma/database';
import type { PlatformProviderRegistry } from '@sma/providers';
import {
  presentCountOrNet,
  resolveAnalyticsPeriod,
  resolveSocialConnectionStatus,
  TIKTOK_SYNC_ERROR_CODE,
  type AnalyticsPeriodInput,
  type ResolvedAnalyticsPeriod,
  type TikTokAnalyticsResponse,
  type TikTokConnectionAccount,
  type TikTokConnectionResponse,
  type TikTokSyncStatusResponse,
} from '@sma/types';
import { PLATFORM_PROVIDER_REGISTRY } from '../../infrastructure/providers/providers.tokens';
import { CurrentUserService } from '../auth/current-user.service';
import { SyncService } from '../sync/sync.service';

function bigintToString(value: bigint | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toString();
}

@Injectable()
export class TikTokService {
  constructor(
    private readonly currentUser: CurrentUserService,
    private readonly platforms: PlatformRepository,
    private readonly socialAccounts: SocialAccountRepository,
    private readonly accountMetrics: AccountMetricsRepository,
    private readonly socialPosts: SocialPostRepository,
    private readonly syncJobs: SyncJobRepository,
    private readonly syncService: SyncService,
    @Inject(PLATFORM_PROVIDER_REGISTRY)
    private readonly providers: PlatformProviderRegistry,
  ) {}

  async getConnection(request: Request, response: Response): Promise<TikTokConnectionResponse> {
    try {
      const account = await this.findTikTokAccount(request, response);
      if (!account) {
        return { connected: false, status: 'disconnected', account: null };
      }

      const status = resolveSocialConnectionStatus({
        connectionStatus: account.connectionStatus,
        isConnected: account.isConnected,
      });
      if (status === 'disconnected') {
        return { connected: false, status, account: null };
      }

      const metrics = await this.accountMetrics.findBySocialAccountId(account.socialAccountId);
      const mapped: TikTokConnectionAccount = {
        id: account.socialAccountId.toString(),
        platformAccountId: account.platformAccountId,
        displayName: account.displayName,
        username: account.username,
        profileImageUrl: account.profileImageUrl,
        profileUrl: account.profileUrl,
        bio: account.socialProfiles?.bio ?? null,
        countryCode: account.socialProfiles?.countryCode ?? null,
        publishedAt: account.socialProfiles?.publishedAt?.toISOString() ?? null,
        subscribersCount: bigintToString(
          account.socialProfiles?.subscribersCount ?? metrics?.followersCount ?? metrics?.subscribersCount,
        ),
        followingCount: bigintToString(metrics?.followingCount),
        likesCount: bigintToString(metrics?.likesCount),
        totalViews: null,
        totalPosts: bigintToString(account.socialProfiles?.totalPosts),
      };

      return { connected: status === 'connected', status, account: mapped };
    } catch {
      throw new ServiceUnavailableException({
        message: 'Database is unavailable.',
        messageAr: 'قاعدة البيانات غير متاحة.',
        database: 'disconnected',
      });
    }
  }

  async getAnalytics(
    request: Request,
    response: Response,
    query: AnalyticsPeriodInput = {},
  ): Promise<TikTokAnalyticsResponse> {
    const resolved = resolveAnalyticsPeriod(query, { inclusiveEndOffsetDays: 0 });
    if (!resolved.ok) {
      throw new BadRequestException({
        code: resolved.error.code,
        message: resolved.error.message,
        messageAr: resolved.error.messageAr,
      });
    }
    const period = resolved.period;

    const account = await this.findTikTokAccount(request, response);
    if (!account || resolveSocialConnectionStatus(account) === 'disconnected') {
      return this.unavailable(
        'no_connected_accounts',
        'Analytics will appear after a TikTok account is connected and synchronized.',
        'ستظهر التحليلات بعد ربط تيك توك ومزامنته.',
        period,
      );
    }
    if (resolveSocialConnectionStatus(account) === 'reauth_required') {
      return this.unavailable(
        'provider_not_ready',
        'TikTok reauthorization is required. Connect TikTok again.',
        'يلزم إعادة تفويض تيك توك. أعد الربط.',
        period,
      );
    }

    const provider = this.providers.tryGet('tiktok');
    if (!provider?.isImplemented) {
      return this.unavailable(
        'provider_not_ready',
        'TikTok OAuth is not configured on this server.',
        'تيك توك غير مهيأ على هذا الخادم.',
        period,
      );
    }

    const [metrics, latestJob, periodPosts] = await Promise.all([
      this.accountMetrics.findBySocialAccountId(account.socialAccountId),
      this.syncJobs.findLatestForAccount(account.socialAccountId),
      this.socialPosts.sumMetricsPublishedBetween(
        account.socialAccountId,
        period.startDate,
        period.endDate,
      ),
    ]);

    const syncing = latestJob?.status === 'queued' || latestJob?.status === 'running';
    const lastSyncedAt = account.lastSyncedAt?.toISOString() ?? null;

    if (!lastSyncedAt && !metrics) {
      return this.unavailable(
        'sync_not_completed',
        'Connect TikTok and run a sync to load analytics.',
        'اربط تيك توك وشغّل المزامنة لتحميل التحليلات.',
        period,
      );
    }

    const likes = presentCountOrNet(periodPosts.likes, null);
    const engagement = presentCountOrNet(
      calculateEngagement(periodPosts.likes, periodPosts.comments, periodPosts.shares),
      null,
    );

    return {
      status: syncing ? 'syncing' : 'ready',
      message: syncing
        ? 'TikTok synchronization is running.'
        : 'TikTok analytics from synced videos in the selected period.',
      messageAr: syncing ? 'تجري مزامنة تيك توك الآن.' : 'تحليلات تيك توك للفيديوهات في الفترة المحددة.',
      account: {
        id: account.socialAccountId.toString(),
        platformAccountId: account.platformAccountId,
        displayName: account.displayName,
        username: account.username,
        profileImageUrl: account.profileImageUrl,
      },
      range: this.toRange(period),
      lastSyncedAt,
      periodError: null,
      sync: {
        status: latestJob?.status ?? null,
        jobType: latestJob?.jobType ?? null,
        errorMessage: latestJob?.errorMessage ?? null,
      },
      metrics: {
        subscribers: bigintToString(
          account.socialProfiles?.subscribersCount ?? metrics?.subscribersCount ?? metrics?.followersCount,
        ),
        totalViews: null,
        videos: bigintToString(account.socialProfiles?.totalPosts ?? null),
        views: bigintToString(periodPosts.views),
        likes: likes.value,
        likesKind: likes.kind,
        comments: bigintToString(periodPosts.comments),
        shares: bigintToString(periodPosts.shares),
        engagement: engagement.value,
        engagementKind: engagement.kind,
        subscribersGained: null,
        subscribersLost: null,
        watchTimeSeconds: null,
        averageViewDurationSeconds: null,
      },
    };
  }

  async getSyncStatus(request: Request, response: Response): Promise<TikTokSyncStatusResponse> {
    const account = await this.findTikTokAccount(request, response);
    if (!account) {
      return {
        status: 'idle',
        syncJobId: null,
        jobId: null,
        message: 'No TikTok account is connected.',
        messageAr: 'لا يوجد حساب تيك توك مربوط.',
        lastSyncedAt: null,
      };
    }

    const latestJob = await this.syncJobs.findLatestForAccount(account.socialAccountId);
    const status =
      latestJob?.status === 'queued' ||
      latestJob?.status === 'running' ||
      latestJob?.status === 'completed' ||
      latestJob?.status === 'failed'
        ? latestJob.status
        : 'idle';

    return {
      status,
      syncJobId: latestJob ? latestJob.syncJobId.toString() : null,
      jobId: null,
      message: latestJob?.errorMessage ?? `TikTok sync is ${status}.`,
      messageAr: 'حالة مزامنة تيك توك.',
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
    };
  }

  async requestSync(request: Request, response: Response): Promise<TikTokSyncStatusResponse> {
    const account = await this.findTikTokAccount(request, response);
    if (!account || resolveSocialConnectionStatus(account) === 'disconnected') {
      throw new BadRequestException({
        code: TIKTOK_SYNC_ERROR_CODE,
        message: 'Connect TikTok before synchronizing analytics.',
      });
    }
    if (resolveSocialConnectionStatus(account) === 'reauth_required') {
      throw new BadRequestException({
        code: TIKTOK_SYNC_ERROR_CODE,
        message: 'TikTok reauthorization is required. Connect TikTok again.',
      });
    }

    const latestJob = await this.syncJobs.findLatestForAccount(account.socialAccountId);
    if (latestJob?.status === 'queued' || latestJob?.status === 'running') {
      return {
        status: latestJob.status,
        syncJobId: latestJob.syncJobId.toString(),
        jobId: null,
        message: 'A TikTok sync job is already running.',
        messageAr: 'هناك عملية مزامنة جارية بالفعل.',
        lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      };
    }

    const queued = await this.syncService.enqueueTikTokSync(account.socialAccountId, 'manual');
    return {
      status: 'queued',
      syncJobId: queued.syncJobId,
      jobId: queued.jobId,
      message: 'TikTok sync is running in the background.',
      messageAr: 'تجري مزامنة تيك توك في الخلفية.',
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
    };
  }

  private async findTikTokAccount(request: Request, response: Response) {
    const user = await this.currentUser.resolve(request, response);
    const platform = await this.platforms.findByCode('tiktok');
    if (!platform) {
      return null;
    }
    return this.socialAccounts.findByUserAndPlatform(user.userId, platform.platformId);
  }

  private toRange(period?: ResolvedAnalyticsPeriod): TikTokAnalyticsResponse['range'] {
    if (!period) {
      return {
        startDate: null,
        endDate: null,
        requestedStartDate: null,
        requestedEndDate: null,
        preset: null,
        clamped: false,
      };
    }
    return {
      startDate: period.startDate,
      endDate: period.endDate,
      requestedStartDate: period.requestedStartDate,
      requestedEndDate: period.requestedEndDate,
      preset: period.preset,
      clamped: period.clamped,
    };
  }

  private unavailable(
    reason: 'no_connected_accounts' | 'provider_not_ready' | 'sync_not_completed',
    message: string,
    messageAr: string,
    period?: ResolvedAnalyticsPeriod,
  ): TikTokAnalyticsResponse {
    return {
      status: 'unavailable',
      reason,
      message,
      messageAr,
      account: null,
      range: this.toRange(period),
      lastSyncedAt: null,
      periodError: null,
      sync: { status: null, jobType: null, errorMessage: null },
      metrics: {
        subscribers: null,
        totalViews: null,
        videos: null,
        views: null,
        likes: null,
        likesKind: 'unavailable',
        comments: null,
        shares: null,
        engagement: null,
        engagementKind: 'unavailable',
        subscribersGained: null,
        subscribersLost: null,
        watchTimeSeconds: null,
        averageViewDurationSeconds: null,
      },
    };
  }
}

function calculateEngagement(
  likes: bigint | null,
  comments: bigint | null,
  shares: bigint | null,
): bigint | null {
  if (likes === null && comments === null && shares === null) {
    return null;
  }
  return (likes ?? 0n) + (comments ?? 0n) + (shares ?? 0n);
}
