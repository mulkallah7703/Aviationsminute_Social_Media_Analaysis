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
  app.getHttpAdapter().getInstance().set('trust proxy', env.TRUST_PROXY);
  app.enableShutdownHooks();
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cookieParser(env.SESSION_SECRET));
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  });
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(env.API_PORT, env.API_HOST);
  logger.info(
    { port: env.API_PORT, host: env.API_HOST, nodeEnv: env.NODE_ENV },
    'API listening',
  );
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'API bootstrap failed';
  // Avoid dumping stack secrets; message from env validation is safe field names only.
  console.error(`[api] fatal: ${message}`);
  process.exit(1);
});
