export interface OAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
  tokenType?: string;
  /** Provider-specific subject id (e.g. TikTok open_id). */
  openId?: string;
}

export interface NormalizedSocialProfile {
  platformUserId: string;
  handle?: string;
  displayName?: string;
  avatarUrl?: string;
  profileUrl?: string;
  description?: string;
  countryCode?: string;
  languageCode?: string;
  publishedAt?: Date;
  subscribersCount?: bigint;
  totalViews?: bigint;
  totalPosts?: bigint;
  verified?: boolean;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface YoutubeChannelSnapshot {
  channelId: string;
  title: string;
  description?: string;
  customUrl?: string;
  thumbnailUrl?: string;
  profileUrl: string;
  countryCode?: string;
  languageCode?: string;
  publishedAt?: Date;
  subscribersCount?: bigint;
  totalViews?: bigint;
  videoCount?: bigint;
  uploadsPlaylistId?: string;
}

export interface YoutubeAnalyticsRange {
  startDate: string;
  endDate: string;
}

export interface YoutubeChannelAnalytics {
  range: YoutubeAnalyticsRange;
  views?: bigint;
  /** Period net likes (likes added minus likes removed). Can be negative. */
  likes?: bigint;
  comments?: bigint;
  shares?: bigint;
  subscribersGained?: bigint;
  subscribersLost?: bigint;
  estimatedMinutesWatched?: bigint;
  averageViewDurationSeconds?: number;
}

export interface YoutubeVideoSnapshot {
  videoId: string;
  title?: string;
  description?: string;
  publishedAt?: Date;
  thumbnailUrl?: string;
  url: string;
  views?: bigint;
  likes?: bigint;
  comments?: bigint;
  shares?: bigint;
  watchTimeSeconds?: bigint;
  subscribersGained?: bigint;
  subscribersLost?: bigint;
}

export interface TikTokUserSnapshot {
  openId: string;
  displayName?: string;
  avatarUrl?: string;
  profileUrl?: string;
  bioDescription?: string;
  followerCount?: bigint;
  followingCount?: bigint;
  likesCount?: bigint;
  videoCount?: bigint;
}

export interface TikTokVideoSnapshot {
  videoId: string;
  title?: string;
  description?: string;
  durationSeconds?: number;
  coverImageUrl?: string;
  embedLink?: string;
  publishedAt?: Date;
  views?: bigint;
  likes?: bigint;
  comments?: bigint;
  shares?: bigint;
}

export interface NormalizedPost {
  externalPostId: string;
  title?: string;
  description?: string;
  url?: string;
  contentType?: string;
  publishedAt?: Date;
  thumbnailUrl?: string;
}

export interface NormalizedPostPage {
  items: NormalizedPost[];
  nextCursor?: string;
}

export interface NormalizedPostMetrics {
  externalPostId: string;
  capturedAt: Date;
  metrics: Record<string, number>;
}

export interface NormalizedAccountMetrics {
  capturedAt: Date;
  metrics: Record<string, number>;
}
