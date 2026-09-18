import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { parseApiEnv, parseRedisUrl } from '@sma/config';
import { QUEUE_NAMES } from '@sma/types';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const env = parseApiEnv();
        return {
          connection: parseRedisUrl(env.REDIS_URL),
        };
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.SOCIAL_SYNC,
    }),
  ],
  exports: [BullModule],
})
export class QueueInfrastructureModule {}
