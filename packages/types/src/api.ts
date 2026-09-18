import type { AnalyticsPeriodPreset } from './analytics-period';
import type { SocialConnectionStatus } from './connection';
import type { MetricValueKind } from './metrics';

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  messageAr?: string;
  requestId?: string;
}

export interface ApiSuccessBody<T> {
  data: T;
}

export interface HealthLiveResponse {
  status: 'ok' | 'degraded';
  service: 'api';
  database: 'connected' | 'disconnected';
  timestamp: string;
}

export interface HealthReadyResponse {
  status: 'ok' | 'degraded';
  service: 'api';
  timestamp: string;
  checks: {
    database: 'connected' | 'disconnected';
    redis: 'up' | 'down';
  };
}

export interface PlatformListItem {
  code: string;
  name: string;
  nameAr: string;
  availability: 'available' | 'coming_soon';
  isConnectable: boolean;
  comingSoonLabel: string;
  comingSoonLabelAr: string;
}

export interface SocialAccountListItem {
  id: string;
  platformCode: string;
  displayName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  profileUrl: string | null;
  status: string;
  subscribersCount: string | null;
  totalViews: string | null;
  totalPosts: string | null;
}

export interface YoutubeConnectionAccount {
  id: string;
  platformAccountId: string;
  displayName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  profileUrl: string | null;
  bio: string | null;
  countryCode: string | null;
  publishedAt: string | null;
  subscribersCount: string | null;
  totalViews: string | null;
  totalPosts: string | null;
}

export interface YoutubeConnectionResponse {
  connected: boolean;
  status: SocialConnectionStatus;
  account: YoutubeConnectionAccount | null;
}

export interface AnalyticsUnavailableResponse {
  status: 'unavailable';
  message: string;
  messageAr: string;
  reason: 'no_connected_accounts' | 'provider_not_ready' | 'sync_not_completed';
}

export const OAUTH_ERROR_CODES = [
  'access_denied',
  'invalid_grant',
  'invalid_client',
  'redirect_uri_mismatch',
  'missing_code',
  'missing_state',
  'invalid_state',
  'token_exchange_failed',
  'no_youtube_channel',
  'quota_exceeded',
  'youtube_api_error',
  'database_failure',
  'oauth_error',
  'reauthorization_required',
] as const;

export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number];

export const OAUTH_ERROR_MESSAGES: Record<OAuthErrorCode, { en: string; ar: string }> = {
  access_denied: {
    en: 'YouTube authorization was denied.',
    ar: 'تم رفض تفويض يوتيوب.',
  },
  invalid_grant: {
    en: 'The authorization code is invalid or has expired. Try connecting again.',
    ar: 'رمز التفويض غير صالح أو منتهٍ. حاول الربط مرة أخرى.',
  },
  invalid_client: {
    en: 'Google rejected the OAuth client configuration.',
    ar: 'رفض Google إعداد تطبيق OAuth.',
  },
  redirect_uri_mismatch: {
    en: 'The redirect URI does not match the Google Cloud client configuration.',
    ar: 'رابط إعادة التوجيه لا يطابق إعداد Google Cloud.',
  },
  missing_code: {
    en: 'Google did not return an authorization code.',
    ar: 'لم يُرجع Google رمز التفويض.',
  },
  missing_state: {
    en: 'The OAuth state is missing. Try connecting again.',
    ar: 'قيمة الحماية مفقودة. حاول الربط مرة أخرى.',
  },
  invalid_state: {
    en: 'The OAuth state is invalid. Try connecting again.',
    ar: 'قيمة الحماية غير صالحة. حاول الربط مرة أخرى.',
  },
  token_exchange_failed: {
    en: 'Google token exchange failed. Try connecting again.',
    ar: 'فشل استبدال رمز التفويض. حاول الربط مرة أخرى.',
  },
  no_youtube_channel: {
    en: 'This Google account does not have a YouTube channel.',
    ar: 'حساب Google هذا لا يحتوي على قناة يوتيوب.',
  },
  quota_exceeded: {
    en: 'The YouTube API quota was exceeded. Try again later.',
    ar: 'تم تجاوز حد استخدام واجهة يوتيوب. حاول لاحقاً.',
  },
  youtube_api_error: {
    en: 'YouTube could not return the authenticated channel.',
    ar: 'تعذر على يوتيوب إرجاع القناة المصادق عليها.',
  },
  database_failure: {
    en: 'The YouTube connection could not be saved.',
    ar: 'تعذر حفظ ربط يوتيوب.',
  },
  oauth_error: {
    en: 'YouTube authorization failed. Try connecting again.',
    ar: 'فشل تفويض يوتيوب. حاول الربط مرة أخرى.',
  },
  reauthorization_required: {
    en: 'YouTube access was revoked. Connect YouTube again to continue.',
    ar: 'تم إلغاء صلاحية يوتيوب. أعد الربط للمتابعة.',
  },
};

export function isOAuthErrorCode(value: string): value is OAuthErrorCode {
  return (OAUTH_ERROR_CODES as readonly string[]).includes(value);
}

export const YOUTUBE_SYNC_ERROR_CODE = 'YOUTUBE_ANALYTICS_SYNC_FAILED' as const;

export interface YoutubeAnalyticsMetricValue {
  value: string | null;
  unavailable: boolean;
}

export interface YoutubeAnalyticsResponse {
  status: 'ready' | 'syncing' | 'unavailable';
  message: string;
  messageAr: string;
  reason?: 'no_connected_accounts' | 'provider_not_ready' | 'sync_not_completed';
  account: {
    id: string;
    platformAccountId: string;
    displayName: string | null;
    username: string | null;
    profileImageUrl: string | null;
  } | null;
  range: {
    startDate: string | null;
    endDate: string | null;
    requestedStartDate: string | null;
    requestedEndDate: string | null;
    preset: AnalyticsPeriodPreset | null;
    clamped: boolean;
  };
  lastSyncedAt: string | null;
  periodError: string | null;
  sync: {
    status: string | null;
    jobType: string | null;
    errorMessage: string | null;
  };
  metrics: {
    subscribers: string | null;
    totalViews: string | null;
    videos: string | null;
    views: string | null;
    likes: string | null;
    likesKind: MetricValueKind;
    comments: string | null;
    shares: string | null;
    engagement: string | null;
    engagementKind: MetricValueKind;
    subscribersGained: string | null;
    subscribersLost: string | null;
    watchTimeSeconds: string | null;
    averageViewDurationSeconds: string | null;
  };
}

export interface YoutubeSyncStatusResponse {
  status: 'queued' | 'running' | 'completed' | 'failed' | 'idle';
  syncJobId: string | null;
  jobId: string | null;
  message: string;
  messageAr: string;
  lastSyncedAt: string | null;
}

export type AnalyticsOverviewResponse = AnalyticsUnavailableResponse | YoutubeAnalyticsResponse;

