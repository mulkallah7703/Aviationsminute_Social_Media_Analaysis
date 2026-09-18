import type { PrismaClient } from '@prisma/client';

export class SocialTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findBySocialAccountId(socialAccountId: bigint) {
    return this.prisma.socialTokens.findUnique({
      where: { socialAccountId },
    });
  }

  updateEncryptedTokens(
    socialAccountId: bigint,
    input: {
      accessTokenEncrypted: string;
      refreshTokenEncrypted?: string | null;
      tokenType?: string | null;
      expiresAt?: Date | null;
      scope?: string | null;
    },
  ) {
    return this.prisma.socialTokens.update({
      where: { socialAccountId },
      data: {
        accessTokenEncrypted: input.accessTokenEncrypted,
        ...(typeof input.refreshTokenEncrypted === 'string' && input.refreshTokenEncrypted.length > 0
          ? { refreshTokenEncrypted: input.refreshTokenEncrypted }
          : {}),
        tokenType: input.tokenType,
        expiresAt: input.expiresAt,
        scope: input.scope,
        updatedAt: new Date(),
      },
    });
  }
}
