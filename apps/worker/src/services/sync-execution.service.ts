import { Inject, Injectable, Logger } from '@nestjs/common';
import { parseWorkerEnv } from '@sma/config';
import { SyncJobRepository, YoutubeAccountSync } from '@sma/database';
import { type PlatformProviderRegistry, type YouTubePlatformProvider } from '@sma/providers';
import { isPlatformCode, type SyncAccountJobPayload } from '@sma/types';
import { PLATFORM_PROVIDER_REGISTRY } from '../providers.tokens';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SyncExecutionService {
  private readonly logger = new Logger(SyncExecutionService.name);

  constructor(
    @Inject(PLATFORM_PROVIDER_REGISTRY)
    private readonly providerRegistry: PlatformProviderRegistry,
    private readonly prisma: PrismaService,
  ) {}

  async execute(payload: SyncAccountJobPayload) {
    if (!isPlatformCode(payload.platformCode) || payload.platformCode !== 'youtube') {
      this.logger.log(`Skipping unsupported platform ${payload.platformCode}.`);
      await this.failJob(payload.syncJobId, 'Unsupported platform for this worker.');
      return {
        status: 'skipped' as const,
        reason: 'unknown_platform',
      };
    }

    const provider = this.providerRegistry.tryGet('youtube') as YouTubePlatformProvider | undefined;
    if (!provider?.isImplemented) {
      this.logger.log('Skipping YouTube sync. Provider is not configured.');
      await this.failJob(payload.syncJobId, 'YouTube provider is not configured.');
      return {
        status: 'skipped' as const,
        reason: 'provider_not_ready',
        platformCode: payload.platformCode,
        socialAccountId: payload.socialAccountId,
      };
    }

    const env = parseWorkerEnv();
    const sync = new YoutubeAccountSync(
      this.prisma.instance,
      provider,
      env.SOCIAL_TOKEN_ENCRYPTION_KEY,
    );

    this.logger.log(`Starting YouTube sync for account ${payload.socialAccountId}.`);
    const result = await sync.syncAccount(
      BigInt(payload.socialAccountId),
      payload.syncJobId ? BigInt(payload.syncJobId) : undefined,
    );
    this.logger.log(`YouTube sync finished with status ${result.status}.`);
    if ('warning' in result && result.warning) {
      this.logger.warn(result.warning);
    }
    return result;
  }

  private async failJob(syncJobId: string | undefined, errorMessage: string): Promise<void> {
    if (!syncJobId) {
      return;
    }
    await new SyncJobRepository(this.prisma.instance).markFailed(BigInt(syncJobId), errorMessage);
  }
}
