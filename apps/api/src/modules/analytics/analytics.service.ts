import { Injectable } from '@nestjs/common';
import { AccountMetricsRepository, SocialAccountRepository } from '@sma/database';
import {
  presentCountOrNet,
  resolveAnalyticsPeriod,
  type AnalyticsOverviewResponse,
  type AnalyticsUnavailableResponse,
} from '@sma/types';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly socialAccountRepository: SocialAccountRepository,
    private readonly accountMetrics: AccountMetricsRepository,
  ) {}

  async overview(): Promise<AnalyticsOverviewResponse> {
    const connectedCount = await this.countConnectedAccounts();

    if (connectedCount === 0) {
      return this.unavailable(
        'no_connected_accounts',
        'Analytics will appear after a social account is connected and synchronized.',
        'ستظهر التحليلات بعد ربط حساب ومزامنته.',
      );
    }

    const accounts = await this.socialAccountRepository.findAll();
    const youtube = accounts.find(
      (account) => account.platforms.platformCode === 'youtube' && account.isConnected,
    );
    if (!youtube) {
      return this.unavailable(
        'sync_not_completed',
        'Connected accounts exist, but YouTube analytics have not been synchronized yet.',
        'توجد حسابات مربوطة، لكن تحليلات يوتيوب لم تُزامن بعد.',
      );
    }

    const metrics = await this.accountMetrics.findBySocialAccountId(youtube.socialAccountId);
    if (!metrics) {
      return this.unavailable(
        'sync_not_completed',
        'Connected accounts exist, but YouTube analytics have not been synchronized yet.',
        'توجد حسابات مربوطة، لكن تحليلات يوتيوب لم تُزامن بعد.',
      );
    }

    const bigintToString = (value: bigint | null | undefined): string | null =>
      value === null || value === undefined ? null : value.toString();
    const likes = presentCountOrNet(metrics.likesCount, metrics.likesDelta);
    const engagement = presentCountOrNet(metrics.engagementCount, metrics.engagementDelta);
    const period = resolveAnalyticsPeriod({ preset: '1m' });
    const range = period.ok
      ? {
          startDate: period.period.startDate,
          endDate: period.period.endDate,
          requestedStartDate: period.period.requestedStartDate,
          requestedEndDate: period.period.requestedEndDate,
          preset: period.period.preset,
          clamped: period.period.clamped,
        }
      : {
          startDate: null,
          endDate: null,
          requestedStartDate: null,
          requestedEndDate: null,
          preset: null,
          clamped: false,
        };

    return {
      status: 'ready',
      message: 'Live YouTube analytics.',
      messageAr: 'تحليلات يوتيوب المباشرة.',
      account: {
        id: youtube.socialAccountId.toString(),
        platformAccountId: youtube.platformAccountId,
        displayName: youtube.displayName,
        username: youtube.username,
        profileImageUrl: youtube.profileImageUrl,
      },
      range,
      lastSyncedAt: youtube.lastSyncedAt?.toISOString() ?? null,
      periodError: null,
      sync: { status: null, jobType: null, errorMessage: null },
      metrics: {
        subscribers: bigintToString(youtube.socialProfiles?.subscribersCount ?? metrics?.subscribersCount),
        totalViews: bigintToString(youtube.socialProfiles?.totalViews),
        videos: bigintToString(youtube.socialProfiles?.totalPosts),
        views: bigintToString(metrics?.viewsCount),
        likes: likes.value,
        likesKind: likes.kind,
        comments: bigintToString(metrics?.commentsCount),
        shares: bigintToString(metrics?.sharesCount),
        engagement: engagement.value,
        engagementKind: engagement.kind,
        subscribersGained: bigintToString(metrics?.subscribersGained),
        subscribersLost: bigintToString(metrics?.subscribersLost),
        watchTimeSeconds: bigintToString(metrics?.watchTimeSeconds),
        averageViewDurationSeconds: null,
      },
    };
  }

  async accountOverview(accountId: string): Promise<AnalyticsOverviewResponse> {
    try {
      const account = await this.socialAccountRepository.findById(BigInt(accountId));
      if (!account) {
        return this.unavailable(
          'no_connected_accounts',
          'The requested account was not found.',
          'الحساب المطلوب غير موجود.',
        );
      }
      return this.overview();
    } catch {
      return this.unavailable(
        'provider_not_ready',
        'Account analytics require a completed platform sync.',
        'تحليلات الحساب تتطلب مزامنة مكتملة.',
      );
    }
  }

  private unavailable(
    reason: AnalyticsUnavailableResponse['reason'],
    message: string,
    messageAr: string,
  ): AnalyticsUnavailableResponse {
    return {
      status: 'unavailable',
      reason,
      message,
      messageAr,
    };
  }

  private async countConnectedAccounts(): Promise<number> {
    try {
      return await this.socialAccountRepository.countConnected();
    } catch {
      return 0;
    }
  }
}
