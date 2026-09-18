import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createPrismaClient, disconnectPrismaClient, type PrismaClient } from '@sma/database';
import { parseWorkerEnv } from '@sma/config';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private readonly client: PrismaClient;

  constructor() {
    const env = parseWorkerEnv();
    this.client = createPrismaClient(env.DATABASE_URL);
  }

  get instance(): PrismaClient {
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.$connect();
      this.logger.log('Prisma connected.');
    } catch {
      this.logger.warn('Prisma could not connect during worker startup.');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await disconnectPrismaClient();
  }
}
