import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES, type SyncAccountJobPayload } from '@sma/types';
import { SyncExecutionService } from '../services/sync-execution.service';

@Processor(QUEUE_NAMES.SOCIAL_SYNC)
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(private readonly syncExecutionService: SyncExecutionService) {
    super();
  }

  async process(job: Job<SyncAccountJobPayload>) {
    this.logger.log(`Processing ${job.name} (${job.id ?? 'unknown-id'})`);

    if (
      job.name !== JOB_NAMES.SYNC_ACCOUNT &&
      job.name !== JOB_NAMES.SYNC_ACCOUNT_METRICS &&
      job.name !== JOB_NAMES.SYNC_POSTS &&
      job.name !== JOB_NAMES.SYNC_POST_METRICS
    ) {
      this.logger.warn(`Unknown job name "${job.name}" — skipping.`);
      return { status: 'skipped', reason: 'unknown_job' };
    }

    return this.syncExecutionService.execute(job.data);
  }
}
