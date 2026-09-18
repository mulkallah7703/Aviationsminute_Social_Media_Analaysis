import pino, { type Logger } from 'pino';

export interface LoggerOptions {
  name: string;
  level?: string;
  nodeEnv?: string;
}

export function createLogger(options: LoggerOptions): Logger {
  const isDevelopment = (options.nodeEnv ?? process.env.NODE_ENV) !== 'production';

  return pino({
    name: options.name,
    level: options.level ?? process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: [
        'accessToken',
        'refreshToken',
        'password',
        'passwordHash',
        'DATABASE_URL',
        'GOOGLE_CLIENT_SECRET',
        'SOCIAL_TOKEN_ENCRYPTION_KEY',
        'SESSION_SECRET',
        'authorization',
        'headers.authorization',
        '*.accessToken',
        '*.refreshToken',
        '*.accessTokenEncrypted',
        '*.refreshTokenEncrypted',
        'tokens',
      ],
      censor: '[Redacted]',
    },
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });
}

export type { Logger };
