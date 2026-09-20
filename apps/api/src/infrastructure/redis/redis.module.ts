import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { parseApiEnv, parseRedisUrl } from '@sma/config';
import { REDIS_CLIENT } from './redis.tokens';

class RedisClientProvider implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const env = parseApiEnv();
        const connection = parseRedisUrl(env.REDIS_URL);
        return new Redis({
          host: connection.host,
          port: connection.port,
          username: connection.username,
          password: connection.password,
          db: connection.db,
          ...(connection.tls ? { tls: connection.tls } : {}),
          maxRetriesPerRequest: null,
          lazyConnect: true,
        });
      },
    },
    RedisClientProvider,
  ],
  exports: [REDIS_CLIENT],
})
export class RedisInfrastructureModule {}
