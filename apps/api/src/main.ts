import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { loadRootEnv, parseApiEnv, createLogger } from '@sma/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { NestPinoLogger } from './common/logger/nest-pino.logger';

async function bootstrap(): Promise<void> {
  loadRootEnv();
  const env = parseApiEnv();
  const logger = createLogger({
    name: 'api',
    level: env.LOG_LEVEL,
    nodeEnv: env.NODE_ENV,
  });

  const app = await NestFactory.create(AppModule, {
    logger: new NestPinoLogger(logger),
  });

  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser(env.SESSION_SECRET));
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(env.API_PORT, env.API_HOST);
  logger.info({ port: env.API_PORT, host: env.API_HOST }, 'API listening');
}

void bootstrap();
