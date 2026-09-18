import type { PrismaClient, SocialAccounts } from '@prisma/client';

export interface UpsertConnectedAccountInput {
  userId: bigint;
  platformId: number;
  platformAccountId: string;
  username?: string | null;
  displayName?: string | null;
  accountType?: string | null;
  profileImageUrl?: string | null;
  profileUrl?: string | null;
  accessTokenEncrypted: string;
  refreshTokenEncrypted?: string | null;
  tokenType?: string | null;
  expiresAt?: Date | null;
  scope?: string | null;
  bio?: string | null;
  countryCode?: string | null;
  languageCode?: string | null;
  websiteUrl?: string | null;
  subscribersCount?: bigint | null;
  totalViews?: bigint | null;
  totalPosts?: bigint | null;
  verified?: boolean | null;
  publishedAt?: Date | null;
}

export class SocialAccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAll() {
    return this.prisma.socialAccounts.findMany({
      include: {
        platforms: true,
        socialProfiles: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: bigint) {
    return this.prisma.socialAccounts.findUnique({
      where: { socialAccountId: id },
      include: {
        platforms: true,
        socialProfiles: true,
      },
    });
  }

  findByIdForSync(id: bigint) {
    return this.prisma.socialAccounts.findUnique({
      where: { socialAccountId: id },
      include: {
        platforms: true,
        socialProfiles: true,
        socialTokens: true,
        accountMetrics: true,
      },
    });
  }

  updateLastSyncedAt(socialAccountId: bigint, lastSyncedAt: Date) {
    return this.prisma.socialAccounts.update({
      where: { socialAccountId },
      data: { lastSyncedAt, updatedAt: lastSyncedAt },
    });
  }

  markReauthorizationRequired(socialAccountId: bigint) {
    return this.prisma.socialAccounts.update({
      where: { socialAccountId },
      data: {
        isConnected: true,
        connectionStatus: 'reauth_required',
        updatedAt: new Date(),
      },
    });
  }

  updateProfileCounts(
    socialAccountId: bigint,
    input: {
      username?: string | null;
      displayName?: string | null;
      profileImageUrl?: string | null;
      profileUrl?: string | null;
      bio?: string | null;
      countryCode?: string | null;
      languageCode?: string | null;
      subscribersCount?: bigint | null;
      totalViews?: bigint | null;
      totalPosts?: bigint | null;
      publishedAt?: Date | null;
    },
  ) {
    const now = new Date();
    return this.prisma.$transaction([
      this.prisma.socialAccounts.update({
        where: { socialAccountId },
        data: {
          username: input.username,
          displayName: input.displayName,
          profileImageUrl: input.profileImageUrl,
          profileUrl: input.profileUrl,
          updatedAt: now,
        },
      }),
      this.prisma.socialProfiles.upsert({
        where: { socialAccountId },
        create: {
          socialAccountId,
          bio: input.bio,
          countryCode: input.countryCode,
          languageCode: input.languageCode,
          subscribersCount: input.subscribersCount,
          totalViews: input.totalViews,
          totalPosts: input.totalPosts,
          publishedAt: input.publishedAt,
        },
        update: {
          bio: input.bio,
          countryCode: input.countryCode,
          languageCode: input.languageCode,
          subscribersCount: input.subscribersCount,
          totalViews: input.totalViews,
          totalPosts: input.totalPosts,
          publishedAt: input.publishedAt,
          updatedAt: now,
        },
      }),
    ]);
  }

  findByUserId(userId: bigint) {
    return this.prisma.socialAccounts.findMany({
      where: { userId },
      include: {
        platforms: true,
        socialProfiles: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByUserAndPlatform(userId: bigint, platformId: number) {
    return this.prisma.socialAccounts.findFirst({
      where: { userId, platformId },
      include: {
        platforms: true,
        socialProfiles: true,
        socialTokens: true,
      },
      orderBy: { connectedAt: 'desc' },
    });
  }

  countConnected() {
    return this.prisma.socialAccounts.count({
      where: {
        isConnected: true,
        NOT: { connectionStatus: 'reauth_required' },
      },
    });
  }

  upsertConnectedAccount(input: UpsertConnectedAccountInput): Promise<SocialAccounts> {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.socialAccounts.findUnique({
        where: {
          platformId_platformAccountId: {
            platformId: input.platformId,
            platformAccountId: input.platformAccountId,
          },
        },
        include: {
          socialTokens: true,
        },
      });

      const account = existing
        ? await tx.socialAccounts.update({
            where: { socialAccountId: existing.socialAccountId },
            data: {
              userId: input.userId,
              username: input.username,
              displayName: input.displayName,
              accountType: input.accountType ?? 'channel',
              profileImageUrl: input.profileImageUrl,
              profileUrl: input.profileUrl,
              isConnected: true,
              connectionStatus: 'connected',
              connectedAt: now,
              updatedAt: now,
            },
          })
        : await tx.socialAccounts.create({
            data: {
              userId: input.userId,
              platformId: input.platformId,
              platformAccountId: input.platformAccountId,
              username: input.username,
              displayName: input.displayName,
              accountType: input.accountType ?? 'channel',
              profileImageUrl: input.profileImageUrl,
              profileUrl: input.profileUrl,
              isConnected: true,
              connectionStatus: 'connected',
              connectedAt: now,
            },
          });

      const refreshTokenEncrypted =
        input.refreshTokenEncrypted ?? existing?.socialTokens?.refreshTokenEncrypted;

      await tx.socialTokens.upsert({
        where: { socialAccountId: account.socialAccountId },
        create: {
          socialAccountId: account.socialAccountId,
          accessTokenEncrypted: input.accessTokenEncrypted,
          refreshTokenEncrypted,
          tokenType: input.tokenType,
          expiresAt: input.expiresAt,
          scope: input.scope,
        },
        update: {
          accessTokenEncrypted: input.accessTokenEncrypted,
          refreshTokenEncrypted,
          tokenType: input.tokenType,
          expiresAt: input.expiresAt,
          scope: input.scope,
          updatedAt: now,
        },
      });

      await tx.socialProfiles.upsert({
        where: { socialAccountId: account.socialAccountId },
        create: {
          socialAccountId: account.socialAccountId,
          bio: input.bio,
          countryCode: input.countryCode,
          languageCode: input.languageCode,
          websiteUrl: input.websiteUrl,
          subscribersCount: input.subscribersCount,
          totalViews: input.totalViews,
          totalPosts: input.totalPosts,
          verified: input.verified,
          publishedAt: input.publishedAt,
        },
        update: {
          bio: input.bio,
          countryCode: input.countryCode,
          languageCode: input.languageCode,
          websiteUrl: input.websiteUrl,
          subscribersCount: input.subscribersCount,
          totalViews: input.totalViews,
          totalPosts: input.totalPosts,
          verified: input.verified,
          publishedAt: input.publishedAt,
          updatedAt: now,
        },
      });

      return account;
    });
  }
}
