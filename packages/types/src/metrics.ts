import { resolveAnalyticsPeriod } from './analytics-period';

/**
 * Account metric contract:
 * - *Count fields are non-negative totals or period counts. Negative values are rejected (NULL, not 0).
 * - likesDelta / engagementDelta are signed period nets and may be negative.
 * - Period engagement = present likes net + comments + shares. Missing parts are omitted, not treated as 0.
 * - engagementCount is that sum only when the sum is >= 0; otherwise NULL.
 */
export const NON_NEGATIVE_ACCOUNT_METRIC_FIELDS = [
  'followersCount',
  'followingCount',
  'subscribersCount',
  'viewsCount',
  'likesCount',
  'commentsCount',
  'sharesCount',
  'savesCount',
  'reachCount',
  'impressionsCount',
  'engagementCount',
  'watchTimeSeconds',
  'subscribersGained',
  'subscribersLost',
] as const;

export type NonNegativeAccountMetricField = (typeof NON_NEGATIVE_ACCOUNT_METRIC_FIELDS)[number];

export type MetricValueKind = 'unavailable' | 'count' | 'net';

export interface PresentedMetric {
  value: string | null;
  kind: MetricValueKind;
}

export interface PlatformAccountMetricInput {
  followersCount?: bigint | null;
  followingCount?: bigint | null;
  subscribersCount?: bigint | null;
  viewsCount?: bigint | null;
  likesCount?: bigint | null;
  likesDelta?: bigint | null;
  commentsCount?: bigint | null;
  sharesCount?: bigint | null;
  savesCount?: bigint | null;
  reachCount?: bigint | null;
  impressionsCount?: bigint | null;
  engagementCount?: bigint | null;
  engagementDelta?: bigint | null;
  watchTimeSeconds?: bigint | null;
  subscribersGained?: bigint | null;
  subscribersLost?: bigint | null;
}

export type PlatformAccountMetricValues = {
  [K in NonNegativeAccountMetricField]: bigint | null;
} & {
  likesDelta: bigint | null;
  engagementDelta: bigint | null;
};

export interface PlatformAccountMetricMapping {
  values: PlatformAccountMetricValues;
  rejectedNegativeFields: NonNegativeAccountMetricField[];
}

export function asNonNegativeCount(value?: bigint | null): bigint | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value >= 0n ? value : null;
}

export function calculatePeriodEngagement(
  likes?: bigint | null,
  commentsCount?: bigint | null,
  sharesCount?: bigint | null,
): bigint | null {
  const parts = [likes, commentsCount, sharesCount].filter(
    (value): value is bigint => value !== null && value !== undefined,
  );
  if (parts.length === 0) {
    return null;
  }
  return parts.reduce((total, value) => total + value, 0n);
}

export function calculateEngagementCount(
  likesCount?: bigint | null,
  commentsCount?: bigint | null,
  sharesCount?: bigint | null,
): bigint | null {
  return asNonNegativeCount(calculatePeriodEngagement(likesCount, commentsCount, sharesCount));
}

export function calculateNetSubscriberGrowth(
  subscribersGained?: bigint | null,
  subscribersLost?: bigint | null,
): bigint | null {
  const gained = asNonNegativeCount(subscribersGained);
  const lost = asNonNegativeCount(subscribersLost);
  if (gained === null || lost === null) {
    return null;
  }
  return gained - lost;
}

export function presentCountOrNet(
  count?: bigint | null,
  delta?: bigint | null,
): PresentedMetric {
  if (delta !== null && delta !== undefined) {
    return { value: delta.toString(), kind: 'net' };
  }
  if (count !== null && count !== undefined) {
    return { value: count.toString(), kind: 'count' };
  }
  return { value: null, kind: 'unavailable' };
}

export function mapPlatformAccountMetrics(
  input: PlatformAccountMetricInput,
): PlatformAccountMetricMapping {
  const rejectedNegativeFields: NonNegativeAccountMetricField[] = [];

  const take = (field: NonNegativeAccountMetricField, value?: bigint | null): bigint | null => {
    if (value === null || value === undefined) {
      return null;
    }
    if (value < 0n) {
      rejectedNegativeFields.push(field);
      return null;
    }
    return value;
  };

  const likesDelta = input.likesDelta ?? null;
  const likesCount = take('likesCount', input.likesCount ?? asNonNegativeCount(likesDelta));
  const commentsCount = take('commentsCount', input.commentsCount);
  const sharesCount = take('sharesCount', input.sharesCount);
  const periodLikes = likesDelta ?? likesCount;
  const engagementDelta =
    input.engagementDelta === undefined
      ? calculatePeriodEngagement(periodLikes, commentsCount, sharesCount)
      : input.engagementDelta;
  const engagementCount =
    input.engagementCount === undefined
      ? asNonNegativeCount(engagementDelta)
      : take('engagementCount', input.engagementCount);

  return {
    values: {
      followersCount: take('followersCount', input.followersCount),
      followingCount: take('followingCount', input.followingCount),
      subscribersCount: take('subscribersCount', input.subscribersCount),
      viewsCount: take('viewsCount', input.viewsCount),
      likesCount,
      likesDelta,
      commentsCount,
      sharesCount,
      savesCount: take('savesCount', input.savesCount),
      reachCount: take('reachCount', input.reachCount),
      impressionsCount: take('impressionsCount', input.impressionsCount),
      engagementCount,
      engagementDelta,
      watchTimeSeconds: take('watchTimeSeconds', input.watchTimeSeconds),
      subscribersGained: take('subscribersGained', input.subscribersGained),
      subscribersLost: take('subscribersLost', input.subscribersLost),
    },
    rejectedNegativeFields,
  };
}

export function defaultYoutubeAnalyticsRange(now: Date = new Date()): {
  startDate: string;
  endDate: string;
} {
  const resolved = resolveAnalyticsPeriod({}, { now });
  if (!resolved.ok) {
    throw new Error(resolved.error.message);
  }
  return {
    startDate: resolved.period.startDate,
    endDate: resolved.period.endDate,
  };
}

export function minutesToWatchTimeSeconds(minutes?: bigint | null): bigint | null {
  if (minutes === null || minutes === undefined) {
    return null;
  }
  return minutes * 60n;
}
