import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { parseRedisUrl, parseWorkerEnv } from '@sma/config';
import { createDefaultProviderRegistry } from '@sma/providers';
import { QUEUE_NAMES } from '@sma/types';
import { SyncProcessor } from './processors/sync.processor';
import { SyncExecutionService } from './services/sync-execution.service';
import { PLATFORM_PROVIDER_REGISTRY } from './providers.tokens';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const env = parseWorkerEnv();
        return {
          connection: parseRedisUrl(env.REDIS_URL),
        };
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.SOCIAL_SYNC,
    }),
  ],
  providers: [
    PrismaService,
    {
      provide: PLATFORM_PROVIDER_REGISTRY,
      useFactory: () => {
        const env = parseWorkerEnv();
        const tiktokConfig =
          env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET && env.TIKTOK_REDIRECT_URI
            ? {
                clientKey: env.TIKTOK_CLIENT_KEY,
                clientSecret: env.TIKTOK_CLIENT_SECRET,
                redirectUri: env.TIKTOK_REDIRECT_URI,
                scopes: env.TIKTOK_OAUTH_SCOPES,
              }
            : undefined;
        return createDefaultProviderRegistry(
          {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            redirectUri: env.GOOGLE_REDIRECT_URI,
            scopes: env.YOUTUBE_OAUTH_SCOPES,
          },
          tiktokConfig,
        );
      },
    },
    SyncExecutionService,
    SyncProcessor,
  ],
})
export class WorkerModule {}
