import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { QueueEvents } from 'bullmq';
import type { Request, Response } from 'express';
import { parseApiEnv, parseRedisUrl } from '@sma/config';
import {
  AccountMetricsRepository,
  AnalyticsPeriodCache,
  PlatformRepository,
  SocialAccountRepository,
  SyncJobRepository,
  YoutubeAccountSync,
} from '@sma/database';
import { OAuthFlowError, type PlatformProviderRegistry, type YouTubePlatformProvider } from '@sma/providers';
import {
  defaultYoutubeAnalyticsRange,
  formatUtcDate,
  mapPlatformAccountMetrics,
  minutesToWatchTimeSeconds,
  presentCountOrNet,
  QUEUE_NAMES,
  resolveAnalyticsPeriod,
  resolveSocialConnectionStatus,
  YOUTUBE_SYNC_ERROR_CODE,
  type AnalyticsPeriodInput,
  type PlatformAccountMetricValues,
  type ResolvedAnalyticsPeriod,
  type YoutubeAnalyticsResponse,
  type YoutubeChannelAnalytics,
  type YoutubeConnectionAccount,
  type YoutubeConnectionResponse,
  type YoutubeSyncStatusResponse,
} from '@sma/types';
import { PLATFORM_PROVIDER_REGISTRY } from '../../infrastructure/providers/providers.tokens';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CurrentUserService } from '../auth/current-user.service';
import { SyncService } from '../sync/sync.service';

function bigintToString(value: bigint | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toString();
}

function emptyPeriodMetrics(): PlatformAccountMetricValues {
  return mapPlatformAccountMetrics({}).values;
}

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);

  constructor(
    private readonly currentUser: CurrentUserService,
    private readonly platforms: PlatformRepository,
    private readonly socialAccounts: SocialAccountRepository,
    private readonly accountMetrics: AccountMetricsRepository,
    private readonly syncJobs: SyncJobRepository,
    private readonly syncService: SyncService,
    private readonly periodCache: AnalyticsPeriodCache,
    private readonly prisma: PrismaService,
    @Inject(PLATFORM_PROVIDER_REGISTRY)
    private readonly providers: PlatformProviderRegistry,
  ) {}

  async getConnection(request: Request, response: Response): Promise<YoutubeConnectionResponse> {
    try {
      const account = await this.findYoutubeAccount(request, response);
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

      const mapped: YoutubeConnectionAccount = {
        id: account.socialAccountId.toString(),
        platformAccountId: account.platformAccountId,
        displayName: account.displayName,
        username: account.username,
        profileImageUrl: account.profileImageUrl,
        profileUrl: account.profileUrl,
        bio: account.socialProfiles?.bio ?? null,
        countryCode: account.socialProfiles?.countryCode ?? null,
        publishedAt: account.socialProfiles?.publishedAt?.toISOString() ?? null,
        subscribersCount: bigintToString(account.socialProfiles?.subscribersCount),
        totalViews: bigintToString(account.socialProfiles?.totalViews),
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
  ): Promise<YoutubeAnalyticsResponse> {
    const resolved = resolveAnalyticsPeriod(query);
    if (!resolved.ok) {
      throw new BadRequestException({
        code: resolved.error.code,
        message: resolved.error.message,
        messageAr: resolved.error.messageAr,
      });
    }
    const period = resolved.period;

    const account = await this.findYoutubeAccount(request, response);
    if (!account || resolveSocialConnectionStatus(account) === 'disconnected') {
      return this.unavailable(
        'no_connected_accounts',
        'Analytics will appear after a YouTube account is connected and synchronized.',
        'ستظهر التحليلات بعد ربط يوتيوب ومزامنته.',
        period,
      );
    }
    if (resolveSocialConnectionStatus(account) === 'reauth_required') {
      return this.unavailable(
        'provider_not_ready',
        'YouTube reauthorization is required. Connect YouTube again.',
        'يلزم إعادة تفويض يوتيوب. أعد الربط.',
        period,
      );
    }

    const [metrics, latestJob] = await Promise.all([
      this.accountMetrics.findBySocialAccountId(account.socialAccountId),
      this.syncJobs.findLatestForAccount(account.socialAccountId),
    ]);
    const syncing = latestJob?.status === 'queued' || latestJob?.status === 'running';
    const lastSyncedAt = account.lastSyncedAt?.toISOString() ?? null;
    const cacheKey = AnalyticsPeriodCache.key({
      platform: 'youtube',
      accountId: account.socialAccountId.toString(),
      startDate: period.startDate,
      endDate: period.endDate,
      syncedAt: lastSyncedAt,
    });

    let periodMetrics = this.periodCache.get<PlatformAccountMetricValues>(cacheKey);
    let periodError: string | null = null;
    let averageViewDurationSeconds: number | null = null;

    if (!periodMetrics) {
      const storedReusable = this.canReuseStoredPeriod(period, account.lastSyncedAt);
      if (storedReusable && metrics) {
        periodMetrics = mapPlatformAccountMetrics({
          viewsCount: metrics.viewsCount,
          likesCount: metrics.likesCount,
          likesDelta: metrics.likesDelta,
          commentsCount: metrics.commentsCount,
          sharesCount: metrics.sharesCount,
          engagementCount: metrics.engagementCount,
          engagementDelta: metrics.engagementDelta,
          watchTimeSeconds: metrics.watchTimeSeconds,
          subscribersGained: metrics.subscribersGained,
          subscribersLost: metrics.subscribersLost,
        }).values;
        this.periodCache.set(cacheKey, periodMetrics);
      } else {
        try {
          const live = await this.youtubeSync().fetchChannelAnalytics(account.socialAccountId, {
            startDate: period.startDate,
            endDate: period.endDate,
          });
          this.logger.log(
            `YouTube Analytics period query account=${account.socialAccountId} ${period.startDate}→${period.endDate}`,
          );
          periodMetrics = this.toPeriodMetrics(live);
          averageViewDurationSeconds = live.averageViewDurationSeconds ?? null;
          this.periodCache.set(cacheKey, periodMetrics);
        } catch (error) {
          periodError = this.toPeriodErrorMessage(error);
          periodMetrics = emptyPeriodMetrics();
        }
      }
    }

    const likes = presentCountOrNet(periodMetrics.likesCount, periodMetrics.likesDelta);
    const engagement = presentCountOrNet(periodMetrics.engagementCount, periodMetrics.engagementDelta);

    return {
      status: syncing ? 'syncing' : 'ready',
      message: syncing ? 'YouTube synchronization is running.' : 'Live YouTube analytics.',
      messageAr: syncing ? 'تجري مزامنة يوتيوب الآن.' : 'تحليلات يوتيوب المباشرة.',
      account: {
        id: account.socialAccountId.toString(),
        platformAccountId: account.platformAccountId,
        displayName: account.displayName,
        username: account.username,
        profileImageUrl: account.profileImageUrl,
      },
      range: this.toRange(period),
      lastSyncedAt,
      periodError,
      sync: {
        status: latestJob?.status ?? null,
        jobType: latestJob?.jobType ?? null,
        errorMessage: latestJob?.errorMessage ?? null,
      },
      metrics: {
        subscribers: bigintToString(account.socialProfiles?.subscribersCount ?? metrics?.subscribersCount),
        totalViews: bigintToString(account.socialProfiles?.totalViews),
        videos: bigintToString(account.socialProfiles?.totalPosts),
        views: bigintToString(periodMetrics.viewsCount),
        likes: likes.value,
        likesKind: likes.kind,
        comments: bigintToString(periodMetrics.commentsCount),
        shares: bigintToString(periodMetrics.sharesCount),
        engagement: engagement.value,
        engagementKind: engagement.kind,
        subscribersGained: bigintToString(periodMetrics.subscribersGained),
        subscribersLost: bigintToString(periodMetrics.subscribersLost),
        watchTimeSeconds: bigintToString(periodMetrics.watchTimeSeconds),
        averageViewDurationSeconds:
          averageViewDurationSeconds === null ? null : String(averageViewDurationSeconds),
      },
    };
  }

  async getSyncStatus(request: Request, response: Response): Promise<YoutubeSyncStatusResponse> {
    const account = await this.findYoutubeAccount(request, response);
    if (!account) {
      return {
        status: 'idle',
        syncJobId: null,
        jobId: null,
        message: 'No YouTube account is connected.',
        messageAr: 'لا يوجد حساب يوتيوب مربوط.',
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
      message: latestJob?.errorMessage ?? `YouTube sync is ${status}.`,
      messageAr: 'حالة مزامنة يوتيوب.',
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
    };
  }

  async requestSync(request: Request, response: Response): Promise<YoutubeSyncStatusResponse> {
    const account = await this.findYoutubeAccount(request, response);
    if (!account || resolveSocialConnectionStatus(account) === 'disconnected') {
      throw new BadRequestException({
        code: YOUTUBE_SYNC_ERROR_CODE,
        message: 'Connect YouTube before synchronizing analytics.',
      });
    }
    if (resolveSocialConnectionStatus(account) === 'reauth_required') {
      throw new BadRequestException({
        code: YOUTUBE_SYNC_ERROR_CODE,
        message: 'YouTube reauthorization is required. Connect YouTube again.',
      });
    }

    const latestJob = await this.syncJobs.findLatestForAccount(account.socialAccountId);
    if (latestJob?.status === 'queued' || latestJob?.status === 'running') {
      return {
        status: latestJob.status,
        syncJobId: latestJob.syncJobId.toString(),
        jobId: null,
        message: 'A YouTube sync job is already running.',
        messageAr: 'هناك عملية مزامنة جارية بالفعل.',
        lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      };
    }

    const queued = await this.syncService.enqueueYoutubeSync(account.socialAccountId, 'manual');
    const env = parseApiEnv();
    const queueEvents = new QueueEvents(QUEUE_NAMES.SOCIAL_SYNC, {
      connection: parseRedisUrl(env.REDIS_URL),
    });

    try {
      if (queued.job) {
        await queued.job.waitUntilFinished(queueEvents, 90_000);
      }
      const finished = await this.syncJobs.findById(BigInt(queued.syncJobId));
      const refreshed = await this.socialAccounts.findById(account.socialAccountId);
      this.periodCache.invalidateAccount('youtube', account.socialAccountId.toString());
      const status =
        finished?.status === 'completed' ||
        finished?.status === 'failed' ||
        finished?.status === 'queued' ||
        finished?.status === 'running'
          ? finished.status
          : 'failed';
      return {
        status,
        syncJobId: queued.syncJobId,
        jobId: queued.jobId,
        message:
          status === 'completed'
            ? 'YouTube analytics synchronized.'
            : (finished?.errorMessage ?? 'Unable to synchronize YouTube analytics.'),
        messageAr:
          status === 'completed' ? 'تمت مزامنة تحليلات يوتيوب.' : 'تعذر مزامنة تحليلات يوتيوب.',
        lastSyncedAt: refreshed?.lastSyncedAt?.toISOString() ?? null,
      };
    } catch {
      return {
        status: 'queued',
        syncJobId: queued.syncJobId,
        jobId: queued.jobId,
        message: 'YouTube sync is running in the background.',
        messageAr: 'تجري مزامنة يوتيوب في الخلفية.',
        lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      };
    } finally {
      await queueEvents.close();
    }
  }

  enqueueAfterConnect(socialAccountId: bigint): Promise<void> {
    return this.syncService.enqueueYoutubeSync(socialAccountId, 'scheduled').then(() => undefined);
  }

  private youtubeSync(): YoutubeAccountSync {
    const env = parseApiEnv();
    return new YoutubeAccountSync(
      this.prisma.instance,
      this.providers.get('youtube') as YouTubePlatformProvider,
      env.SOCIAL_TOKEN_ENCRYPTION_KEY,
    );
  }

  private canReuseStoredPeriod(period: ResolvedAnalyticsPeriod, lastSyncedAt: Date | null | undefined): boolean {
    if (!lastSyncedAt) {
      return false;
    }
    const defaultRange = defaultYoutubeAnalyticsRange();
    return (
      period.startDate === defaultRange.startDate &&
      period.endDate === defaultRange.endDate &&
      formatUtcDate(lastSyncedAt) === formatUtcDate(new Date())
    );
  }

  private toPeriodMetrics(analytics: YoutubeChannelAnalytics): PlatformAccountMetricValues {
    return mapPlatformAccountMetrics({
      viewsCount: analytics.views ?? null,
      likesDelta: analytics.likes ?? null,
      commentsCount: analytics.comments ?? null,
      sharesCount: analytics.shares ?? null,
      watchTimeSeconds: minutesToWatchTimeSeconds(analytics.estimatedMinutesWatched),
      subscribersGained: analytics.subscribersGained ?? null,
      subscribersLost: analytics.subscribersLost ?? null,
    }).values;
  }

  private toPeriodErrorMessage(error: unknown): string {
    if (error instanceof OAuthFlowError) {
      return error.message;
    }
    const message = error instanceof Error ? error.message : '';
    return message
      ? message.replace(/ya29\.[^\s]+/gi, '[redacted]').replace(/1\/\/[^\s]+/g, '[redacted]').slice(0, 500)
      : 'YouTube Analytics could not return metrics for the selected period.';
  }

  private toRange(period?: ResolvedAnalyticsPeriod): YoutubeAnalyticsResponse['range'] {
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

  private async findYoutubeAccount(request: Request, response: Response) {
    const user = await this.currentUser.resolve(request, response);
    const platform = await this.platforms.findByCode('youtube');
    if (!platform) {
      return null;
    }
    return this.socialAccounts.findByUserAndPlatform(user.userId, platform.platformId);
  }

  private unavailable(
    reason: 'no_connected_accounts' | 'provider_not_ready' | 'sync_not_completed',
    message: string,
    messageAr: string,
    period?: ResolvedAnalyticsPeriod,
  ): YoutubeAnalyticsResponse {
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
