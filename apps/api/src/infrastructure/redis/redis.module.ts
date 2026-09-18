import { Global, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { parseApiEnv, parseRedisUrl } from '@sma/config';
import { REDIS_CLIENT } from './redis.tokens';

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
          maxRetriesPerRequest: null,
          lazyConnect: true,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisInfrastructureModule {}
