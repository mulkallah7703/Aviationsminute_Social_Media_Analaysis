import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { SyncJobRepository } from '@sma/database';
import { JOB_NAMES, QUEUE_NAMES, type SyncAccountJobPayload, type SyncJobType } from '@sma/types';

@Injectable()
export class SyncService {
  constructor(
    @InjectQueue(QUEUE_NAMES.SOCIAL_SYNC)
    private readonly syncQueue: Queue<SyncAccountJobPayload>,
    private readonly syncJobs: SyncJobRepository,
  ) {}

  async enqueueYoutubeSync(
    socialAccountId: bigint,
    reason: 'scheduled' | 'manual',
    jobType: SyncJobType = 'full',
  ) {
    const jobRow = await this.syncJobs.create({
      socialAccountId,
      jobType,
      status: 'queued',
    });

    const job = await this.syncQueue.add(
      JOB_NAMES.SYNC_ACCOUNT,
      {
        socialAccountId: socialAccountId.toString(),
        platformCode: 'youtube',
        jobType,
        reason,
        syncJobId: jobRow.syncJobId.toString(),
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );

    return {
      status: 'queued' as const,
      syncJobId: jobRow.syncJobId.toString(),
      jobId: job.id ?? null,
      job,
      message: 'YouTube sync job queued.',
      messageAr: 'تمت جدولة مزامنة يوتيوب.',
    };
  }

  async enqueueManualSync(payload: SyncAccountJobPayload) {
    const queued = await this.enqueueYoutubeSync(
      BigInt(payload.socialAccountId),
      payload.reason,
      payload.jobType,
    );
    return {
      status: queued.status,
      syncJobId: queued.syncJobId,
      jobId: queued.jobId,
      message: queued.message,
      messageAr: queued.messageAr,
    };
  }
}
