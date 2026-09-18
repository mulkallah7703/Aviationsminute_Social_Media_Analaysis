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
}
