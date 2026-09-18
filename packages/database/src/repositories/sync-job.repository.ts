import type { PrismaClient, SyncJobs } from '@prisma/client';
import type { SyncJobStatus, SyncJobType } from '@sma/types';

export class SyncJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: { socialAccountId: bigint; jobType: SyncJobType; status?: SyncJobStatus }) {
    return this.prisma.syncJobs.create({
      data: {
        socialAccountId: input.socialAccountId,
        jobType: input.jobType,
        status: input.status ?? 'queued',
      },
    });
  }

  findById(syncJobId: bigint) {
    return this.prisma.syncJobs.findUnique({
      where: { syncJobId },
    });
  }

  findLatestForAccount(socialAccountId: bigint) {
    return this.prisma.syncJobs.findFirst({
      where: { socialAccountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  markRunning(syncJobId: bigint) {
    return this.prisma.syncJobs.update({
      where: { syncJobId },
      data: {
        status: 'running',
        startedAt: new Date(),
      },
    });
  }

  markCompleted(
    syncJobId: bigint,
    counts: {
      recordsFetched?: number;
      recordsInserted?: number;
      recordsUpdated?: number;
      warning?: string;
    },
  ) {
    return this.prisma.syncJobs.update({
      where: { syncJobId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        recordsFetched: counts.recordsFetched,
        recordsInserted: counts.recordsInserted,
        recordsUpdated: counts.recordsUpdated,
        errorMessage: counts.warning ?? null,
      },
    });
  }

  markFailed(syncJobId: bigint, errorMessage: string) {
    return this.prisma.syncJobs.update({
      where: { syncJobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage,
      },
    });
  }

  async incrementRetry(syncJobId: bigint): Promise<SyncJobs> {
    const current = await this.findById(syncJobId);
    return this.prisma.syncJobs.update({
      where: { syncJobId },
      data: {
        retryCount: (current?.retryCount ?? 0) + 1,
      },
    });
  }
}
