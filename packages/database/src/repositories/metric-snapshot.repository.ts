import type { PrismaClient } from '@prisma/client';
import { mapPlatformAccountMetrics, utcDateOnly, type PlatformAccountMetricInput } from '@sma/types';

export class MetricSnapshotRepository {
  constructor(private readonly prisma: PrismaClient) {}

  upsertDailySnapshot(socialAccountId: bigint, snapshotDate: Date, values: PlatformAccountMetricInput) {
    const mapped = mapPlatformAccountMetrics(values);
    const dateOnly = utcDateOnly(snapshotDate);
    return this.prisma.metricSnapshots.upsert({
      where: {
        socialAccountId_snapshotDate: {
          socialAccountId,
          snapshotDate: dateOnly,
        },
      },
      create: {
        socialAccountId,
        snapshotDate: dateOnly,
        ...mapped.values,
      },
      update: {
        ...mapped.values,
      },
    });
  }
}
