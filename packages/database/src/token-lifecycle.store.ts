import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { EncryptedTokenRecord, TokenLifecycleStore } from './token-lifecycle';

type DbClient = PrismaClient | Prisma.TransactionClient;

export class PrismaTokenLifecycleStore implements TokenLifecycleStore {
  private static readonly txContext = new AsyncLocalStorage<Prisma.TransactionClient>();

  constructor(private readonly prisma: PrismaClient) {}

  async load(socialAccountId: bigint): Promise<EncryptedTokenRecord | null> {
    const row = await this.db().socialTokens.findUnique({
      where: { socialAccountId },
    });
    if (!row) {
      return null;
    }
    return {
      accessTokenEncrypted: row.accessTokenEncrypted,
      refreshTokenEncrypted: row.refreshTokenEncrypted,
      tokenType: row.tokenType,
      expiresAt: row.expiresAt,
      scope: row.scope,
    };
  }

  async save(
    socialAccountId: bigint,
    update: {
      accessTokenEncrypted: string;
      refreshTokenEncrypted?: string;
      tokenType?: string | null;
      expiresAt?: Date | null;
      scope?: string | null;
    },
  ): Promise<void> {
    await this.db().socialTokens.update({
      where: { socialAccountId },
      data: {
        accessTokenEncrypted: update.accessTokenEncrypted,
        ...(typeof update.refreshTokenEncrypted === 'string' && update.refreshTokenEncrypted.length > 0
          ? { refreshTokenEncrypted: update.refreshTokenEncrypted }
          : {}),
        tokenType: update.tokenType,
        expiresAt: update.expiresAt,
        scope: update.scope,
        updatedAt: new Date(),
      },
    });
  }

  async markReauthorizationRequired(socialAccountId: bigint): Promise<void> {
    await this.prisma.socialAccounts.update({
      where: { socialAccountId },
      data: {
        isConnected: true,
        connectionStatus: 'reauth_required',
        updatedAt: new Date(),
      },
    });
  }

  async withExclusiveAccess<T>(socialAccountId: bigint, operation: () => Promise<T>): Promise<T> {
    const existing = PrismaTokenLifecycleStore.txContext.getStore();
    if (existing) {
      return operation();
    }

    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT SocialAccountId
          FROM social.SocialTokens WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
          WHERE SocialAccountId = ${socialAccountId}
        `;
        return PrismaTokenLifecycleStore.txContext.run(tx, operation);
      },
      { timeout: 25_000 },
    );
  }

  private db(): DbClient {
    return PrismaTokenLifecycleStore.txContext.getStore() ?? this.prisma;
  }
}
