import type { PrismaClient } from '@prisma/client';
import { mapPlatformAccountMetrics, type PlatformAccountMetricInput } from '@sma/types';

export type AccountMetricValues = PlatformAccountMetricInput;

export class AccountMetricsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findBySocialAccountId(socialAccountId: bigint) {
    return this.prisma.accountMetrics.findUnique({
      where: { socialAccountId },
    });
  }

  upsertForAccount(socialAccountId: bigint, values: AccountMetricValues) {
    const mapped = mapPlatformAccountMetrics(values);
    const now = new Date();
    return this.prisma.accountMetrics.upsert({
      where: { socialAccountId },
      create: {
        socialAccountId,
        ...mapped.values,
        recordedAt: now,
      },
      update: {
        ...mapped.values,
        recordedAt: now,
        updatedAt: now,
      },
    });
  }
}
