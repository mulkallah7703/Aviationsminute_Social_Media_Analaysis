import type { YoutubeChannelAnalytics, YoutubeAnalyticsRange } from '@sma/types';
import { OAuthFlowError } from './errors';

const CHANNEL_METRIC_GROUPS: string[][] = [
  [
    'views',
    'likes',
    'comments',
    'subscribersGained',
    'subscribersLost',
    'estimatedMinutesWatched',
    'averageViewDuration',
  ],
  ['shares'],
];

const VIDEO_ANALYTICS_METRIC_GROUPS: string[][] = [
  ['views', 'likes', 'comments', 'subscribersGained', 'estimatedMinutesWatched'],
  ['shares'],
];

export type YoutubeAnalyticsClient = {
  reports: {
    query: (params: {
      ids: string;
      startDate: string;
      endDate: string;
      metrics: string;
      dimensions?: string;
      maxResults?: number;
      sort?: string;
    }) => Promise<{
      data: {
        columnHeaders?: Array<{ name?: string | null }>;
        rows?: Array<Array<string | number | null>> | null;
      };
    }>;
  };
};

function parseBigIntMetric(value: string | number | null | undefined): bigint | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  try {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return undefined;
      }
      return BigInt(Math.trunc(value));
    }
    if (!/^-?\d+(\.0+)?$/.test(value)) {
      const asNumber = Number(value);
      if (!Number.isFinite(asNumber)) {
        return undefined;
      }
      return BigInt(Math.trunc(asNumber));
    }
    return BigInt(value.split('.')[0] ?? value);
  } catch {
    return undefined;
  }
}

function parseNumberMetric(value: string | number | null | undefined): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function rowToMap(
  headers: Array<{ name?: string | null }> | undefined,
  row: Array<string | number | null> | undefined,
): Map<string, string | number | null> {
  const map = new Map<string, string | number | null>();
  if (!headers || !row) {
    return map;
  }
  headers.forEach((header, index) => {
    const name = header.name;
    if (name) {
      map.set(name, row[index] ?? null);
    }
  });
  return map;
}

function redactSecrets(value: string): string {
  return value.replace(/ya29\.[^\s]+/gi, '[redacted]').replace(/1\/\/[^\s]+/g, '[redacted]');
}

function flattenGoogleError(error: unknown): { status?: number; reasons: string; message: string } {
  const obj = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};
  const response =
    obj.response && typeof obj.response === 'object' ? (obj.response as Record<string, unknown>) : undefined;
  const data = response?.data && typeof response.data === 'object' ? (response.data as Record<string, unknown>) : undefined;
  const nestedError =
    data?.error && typeof data.error === 'object' ? (data.error as Record<string, unknown>) : undefined;
  const status =
    (typeof obj.code === 'number' ? obj.code : undefined) ??
    (typeof response?.status === 'number' ? (response.status as number) : undefined) ??
    (typeof nestedError?.code === 'number' ? (nestedError.code as number) : undefined);
  const errorList = [
    ...(Array.isArray(obj.errors) ? obj.errors : []),
    ...(Array.isArray(nestedError?.errors) ? nestedError.errors : []),
  ] as Array<{ reason?: string; message?: string }>;
  const reasons = errorList
    .map((item) => item.reason ?? '')
    .join(' ')
    .toLowerCase();
  const message = redactSecrets(
    [
      typeof obj.message === 'string' ? obj.message : '',
      typeof nestedError?.message === 'string' ? nestedError.message : '',
      ...errorList.map((item) => item.message ?? ''),
    ].join(' '),
  );
  return { status, reasons, message };
}

function isUnsupportedMetricError(error: unknown): boolean {
  const { message, reasons } = flattenGoogleError(error);
  const haystack = `${message} ${reasons}`.toLowerCase();
  return (
    haystack.includes('unknown metric') ||
    haystack.includes('invalid metric') ||
    haystack.includes('not supported') ||
    haystack.includes('restricted') ||
    haystack.includes('invalid combination') ||
    haystack.includes('incompatible')
  );
}

export function mapAnalyticsApiError(error: unknown): OAuthFlowError {
  const { status, reasons, message } = flattenGoogleError(error);
  const haystack = `${message} ${reasons}`.toLowerCase();

  if (status === 401 || reasons.includes('autherror') || haystack.includes('invalid_grant')) {
    return new OAuthFlowError(
      'reauthorization_required',
      'YouTube rejected the stored credentials. Connect YouTube again.',
    );
  }
  if (
    status === 403 &&
    (reasons.includes('insufficientpermissions') ||
      haystack.includes('insufficient') ||
      haystack.includes('access_token_scope_insufficient'))
  ) {
    return new OAuthFlowError(
      'reauthorization_required',
      'YouTube Analytics permission is missing. Connect YouTube again.',
    );
  }
  if (reasons.includes('quotaexceeded') || status === 429) {
    return new OAuthFlowError('quota_exceeded', 'The YouTube API quota was exceeded. Try again later.');
  }
  if (
    reasons.includes('accessnotconfigured') ||
    haystack.includes('has not been used') ||
    haystack.includes('is disabled') ||
    haystack.includes('access not configured')
  ) {
    return new OAuthFlowError(
      'youtube_api_error',
      'The YouTube Analytics API is not enabled on the Google Cloud project.',
    );
  }

  const detail = message.replace(/\s+/g, ' ').trim().slice(0, 180);
  return new OAuthFlowError(
    'youtube_api_error',
    detail
      ? `YouTube Analytics could not return channel metrics. ${detail}`
      : 'YouTube Analytics could not return channel metrics.',
  );
}

async function queryMetricSet(
  client: YoutubeAnalyticsClient,
  idsCandidates: string[],
  range: YoutubeAnalyticsRange,
  metrics: string[],
  extra?: { dimensions?: string; maxResults?: number; sort?: string },
): Promise<{ headers?: Array<{ name?: string | null }>; rows: Array<Array<string | number | null>> }> {
  const metricsToTry = [...metrics];
  let lastError: unknown;

  while (metricsToTry.length > 0) {
    for (const ids of idsCandidates) {
      try {
        const response = await client.reports.query({
          ids,
          startDate: range.startDate,
          endDate: range.endDate,
          metrics: metricsToTry.join(','),
          ...extra,
        });
        return {
          headers: response.data.columnHeaders,
          rows: response.data.rows ?? [],
        };
      } catch (error) {
        lastError = error;
        if (error instanceof OAuthFlowError) {
          throw error;
        }
        const mapped = mapAnalyticsApiError(error);
        if (mapped.code === 'reauthorization_required' || mapped.code === 'quota_exceeded') {
          throw mapped;
        }
        if (isUnsupportedMetricError(error) && metricsToTry.length > 1) {
          break;
        }
      }
    }
    if (isUnsupportedMetricError(lastError) && metricsToTry.length > 1) {
      metricsToTry.pop();
      continue;
    }
    break;
  }

  throw lastError instanceof OAuthFlowError ? lastError : mapAnalyticsApiError(lastError);
}

function assignChannelMetrics(
  target: YoutubeChannelAnalytics,
  map: Map<string, string | number | null>,
): void {
  const views = parseBigIntMetric(map.get('views'));
  const likes = parseBigIntMetric(map.get('likes'));
  const comments = parseBigIntMetric(map.get('comments'));
  const shares = parseBigIntMetric(map.get('shares'));
  const subscribersGained = parseBigIntMetric(map.get('subscribersGained'));
  const subscribersLost = parseBigIntMetric(map.get('subscribersLost'));
  const estimatedMinutesWatched = parseBigIntMetric(map.get('estimatedMinutesWatched'));
  const averageViewDurationSeconds = parseNumberMetric(map.get('averageViewDuration'));

  if (views !== undefined) target.views = views;
  // Period `likes` is a signed net (added − removed), not a lifetime count.
  if (likes !== undefined) target.likes = likes;
  if (comments !== undefined) target.comments = comments;
  if (shares !== undefined) target.shares = shares;
  if (subscribersGained !== undefined) target.subscribersGained = subscribersGained;
  if (subscribersLost !== undefined) target.subscribersLost = subscribersLost;
  if (estimatedMinutesWatched !== undefined) target.estimatedMinutesWatched = estimatedMinutesWatched;
  if (averageViewDurationSeconds !== undefined) target.averageViewDurationSeconds = averageViewDurationSeconds;
}

export async function queryChannelAnalytics(
  client: YoutubeAnalyticsClient,
  channelId: string,
  range: YoutubeAnalyticsRange,
): Promise<YoutubeChannelAnalytics> {
  const idsCandidates = ['channel==MINE', `channel==${channelId}`];
  const result: YoutubeChannelAnalytics = { range };
  let lastError: unknown;
  let succeeded = false;

  for (const group of CHANNEL_METRIC_GROUPS) {
    try {
      const response = await queryMetricSet(client, idsCandidates, range, group);
      assignChannelMetrics(result, rowToMap(response.headers, response.rows[0]));
      succeeded = true;
    } catch (error) {
      lastError = error;
      if (error instanceof OAuthFlowError && (error.code === 'reauthorization_required' || error.code === 'quota_exceeded')) {
        throw error;
      }
    }
  }

  if (!succeeded && lastError) {
    throw lastError instanceof OAuthFlowError ? lastError : mapAnalyticsApiError(lastError);
  }

  return result;
}

export async function queryVideoAnalyticsByVideoId(
  client: YoutubeAnalyticsClient,
  channelId: string,
  range: YoutubeAnalyticsRange,
): Promise<Map<string, YoutubeChannelAnalytics & { videoId: string }>> {
  const result = new Map<string, YoutubeChannelAnalytics & { videoId: string }>();
  const idsCandidates = ['channel==MINE', `channel==${channelId}`];
  let lastError: unknown;
  let succeeded = false;

  for (const group of VIDEO_ANALYTICS_METRIC_GROUPS) {
    try {
      const response = await queryMetricSet(client, idsCandidates, range, group, {
        dimensions: 'video',
        maxResults: 50,
        sort: '-views',
      });
      succeeded = true;
      for (const row of response.rows) {
        const map = rowToMap(response.headers, row);
        const videoId = String(map.get('video') ?? '');
        if (!videoId) {
          continue;
        }
        const current = result.get(videoId) ?? { videoId, range };
        assignChannelMetrics(current, map);
        result.set(videoId, current);
      }
    } catch (error) {
      lastError = error;
      if (error instanceof OAuthFlowError && (error.code === 'reauthorization_required' || error.code === 'quota_exceeded')) {
        throw error;
      }
    }
  }

  if (!succeeded && lastError) {
    throw lastError instanceof OAuthFlowError ? lastError : mapAnalyticsApiError(lastError);
  }

  return result;
}
