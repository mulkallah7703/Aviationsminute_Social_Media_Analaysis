import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
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

  await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log'],
  });

  logger.info('Worker is listening for sync jobs');
}

void bootstrap();
