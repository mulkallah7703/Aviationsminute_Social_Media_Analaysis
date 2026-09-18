import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import { HealthRepository } from '@sma/database';
import type { HealthLiveResponse, HealthReadyResponse } from '@sma/types';
import { REDIS_CLIENT } from '../../infrastructure/redis/redis.tokens';

@Injectable()
export class HealthService {
  constructor(
    private readonly healthRepository: HealthRepository,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async live(): Promise<HealthLiveResponse> {
    const database = await this.checkDatabase();

    return {
      status: database === 'connected' ? 'ok' : 'degraded',
      service: 'api',
      database,
      timestamp: new Date().toISOString(),
    };
  }

  async ready(): Promise<HealthReadyResponse> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const status = database === 'connected' && redis === 'up' ? 'ok' : 'degraded';

    return {
      status,
      service: 'api',
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };
  }

  private async checkDatabase(): Promise<'connected' | 'disconnected'> {
    try {
      await this.healthRepository.ping();
      return 'connected';
    } catch {
      return 'disconnected';
    }
  }

  private async checkRedis(): Promise<'up' | 'down'> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
