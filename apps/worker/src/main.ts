import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { INestApplicationContext } from '@nestjs/common';
import { loadRootEnv, parseWorkerEnv, createLogger } from '@sma/config';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  loadRootEnv();
  const env = parseWorkerEnv();
  const logger = createLogger({
    name: 'worker',
    level: env.LOG_LEVEL,
    nodeEnv: env.NODE_ENV,
  });

  const app: INestApplicationContext = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, 'Worker shutting down');
    try {
      await app.close();
      logger.info('Worker stopped cleanly');
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Worker shutdown failed';
      logger.error({ err: message }, 'Worker shutdown error');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  logger.info({ nodeEnv: env.NODE_ENV }, 'Worker is listening for sync jobs');
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Worker bootstrap failed';
  console.error(`[worker] fatal: ${message}`);
  process.exit(1);
});
