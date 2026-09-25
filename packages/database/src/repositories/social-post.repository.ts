import type { PrismaClient } from '@prisma/client';
import { asNonNegativeCount, calculateEngagementCount } from '@sma/types';

export interface UpsertSocialPostInput {
  platformPostId: string;
  postType?: string | null;
  title?: string | null;
  description?: string | null;
  postUrl?: string | null;
  thumbnailUrl?: string | null;
  mediaUrl?: string | null;
  publishedAt?: Date | null;
  viewsCount?: bigint | null;
  likesCount?: bigint | null;
  commentsCount?: bigint | null;
  sharesCount?: bigint | null;
  savesCount?: bigint | null;
  engagementCount?: bigint | null;
  watchTimeSeconds?: bigint | null;
  subscribersGained?: bigint | null;
  subscribersLost?: bigint | null;
}

export class SocialPostRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertPostWithMetrics(socialAccountId: bigint, input: UpsertSocialPostInput) {
    const now = new Date();
    const post = await this.prisma.socialPosts.upsert({
      where: {
        socialAccountId_platformPostId: {
          socialAccountId,
          platformPostId: input.platformPostId,
        },
      },
      create: {
        socialAccountId,
        platformPostId: input.platformPostId,
        postType: input.postType,
        title: input.title,
        description: input.description,
        postUrl: input.postUrl,
        thumbnailUrl: input.thumbnailUrl,
        mediaUrl: input.mediaUrl,
        publishedAt: input.publishedAt,
      },
      update: {
        postType: input.postType,
        title: input.title,
        description: input.description,
        postUrl: input.postUrl,
        thumbnailUrl: input.thumbnailUrl,
        mediaUrl: input.mediaUrl,
        publishedAt: input.publishedAt,
        isDeleted: false,
        updatedAt: now,
      },
    });

    const likesCount = asNonNegativeCount(input.likesCount);
    const commentsCount = asNonNegativeCount(input.commentsCount);
    const sharesCount = asNonNegativeCount(input.sharesCount);
    const metrics = {
      viewsCount: asNonNegativeCount(input.viewsCount),
      likesCount,
      commentsCount,
      sharesCount,
      savesCount: asNonNegativeCount(input.savesCount),
      engagementCount:
        input.engagementCount === undefined
          ? calculateEngagementCount(likesCount, commentsCount, sharesCount)
          : asNonNegativeCount(input.engagementCount),
      watchTimeSeconds: asNonNegativeCount(input.watchTimeSeconds),
      subscribersGained: asNonNegativeCount(input.subscribersGained),
      subscribersLost: asNonNegativeCount(input.subscribersLost),
    };

    await this.prisma.postMetrics.upsert({
      where: { socialPostId: post.socialPostId },
      create: {
        socialPostId: post.socialPostId,
        ...metrics,
      },
      update: {
        ...metrics,
        recordedAt: now,
        updatedAt: now,
      },
    });

    return post;
  }

  /**
   * Sum post metrics for videos published within [startDate, endDate] (UTC date-only strings).
   * Missing metric columns stay null (never coerced to 0 for "unknown").
   */
  async sumMetricsPublishedBetween(
    socialAccountId: bigint,
    startDate: string,
    endDate: string,
  ): Promise<{
    views: bigint | null;
    likes: bigint | null;
    comments: bigint | null;
    shares: bigint | null;
    videoCount: number;
  }> {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    const rows = await this.prisma.socialPosts.findMany({
      where: {
        socialAccountId,
        isDeleted: false,
        publishedAt: { gte: start, lte: end },
      },
      include: { postMetrics: true },
    });

    if (rows.length === 0) {
      return { views: null, likes: null, comments: null, shares: null, videoCount: 0 };
    }

    let views: bigint | null = null;
    let likes: bigint | null = null;
    let comments: bigint | null = null;
    let shares: bigint | null = null;

    for (const row of rows) {
      const metrics = row.postMetrics;
      if (!metrics) {
        continue;
      }
      if (metrics.viewsCount !== null && metrics.viewsCount !== undefined) {
        views = (views ?? 0n) + metrics.viewsCount;
      }
      if (metrics.likesCount !== null && metrics.likesCount !== undefined) {
        likes = (likes ?? 0n) + metrics.likesCount;
      }
      if (metrics.commentsCount !== null && metrics.commentsCount !== undefined) {
        comments = (comments ?? 0n) + metrics.commentsCount;
      }
      if (metrics.sharesCount !== null && metrics.sharesCount !== undefined) {
        shares = (shares ?? 0n) + metrics.sharesCount;
      }
    }

    return { views, likes, comments, shares, videoCount: rows.length };
  }
}
