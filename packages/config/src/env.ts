import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);

const requiredSecret = z.string().trim().min(1);

const optionalSecret = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .pipe(z.string().url().optional());

const DEFAULT_YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

const DEFAULT_TIKTOK_SCOPES = ['user.info.basic', 'user.info.stats', 'video.list'];

const scopesSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) {
      return DEFAULT_YOUTUBE_SCOPES;
    }
    const scopes = value.split(/[\s,]+/).filter((item) => item.length > 0);
    return scopes.length > 0 ? scopes : DEFAULT_YOUTUBE_SCOPES;
  });

const tiktokScopesSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) {
      return DEFAULT_TIKTOK_SCOPES;
    }
    const scopes = value.split(/[\s,]+/).filter((item) => item.length > 0);
    return scopes.length > 0 ? scopes : DEFAULT_TIKTOK_SCOPES;
  });

const encryptionKeySchema = z
  .string()
  .trim()
  .min(32, 'SOCIAL_TOKEN_ENCRYPTION_KEY must be at least 32 characters');

const sessionSecretSchema = z
  .string()
  .trim()
  .min(32, 'SESSION_SECRET must be at least 32 characters');

function isLocalhostUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function rejectLocalhostInProduction(
  envName: string,
  value: string | undefined,
  nodeEnv: string,
  ctx: z.RefinementCtx,
): void {
  if (nodeEnv !== 'production' || !value) {
    return;
  }
  if (isLocalhostUrl(value)) {
    ctx.addIssue({
      code: 'custom',
      path: [envName],
      message: `${envName} must not use localhost in production`,
    });
  }
}

function requireHttpsInProduction(
  envName: string,
  value: string | undefined,
  nodeEnv: string,
  ctx: z.RefinementCtx,
): void {
  if (nodeEnv !== 'production' || !value) {
    return;
  }
  if (!value.startsWith('https://')) {
    ctx.addIssue({
      code: 'custom',
      path: [envName],
      message: `${envName} must use https:// in production`,
    });
  }
}

export const apiEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default('development'),
    API_PORT: z.coerce.number().int().positive().default(5000),
    API_HOST: z.string().default('0.0.0.0'),
    WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    TRUST_PROXY: z
      .union([z.literal('true'), z.literal('false'), z.coerce.number().int().nonnegative()])
      .default(1)
      .transform((value) => {
        if (value === 'true') {
          return 1;
        }
        if (value === 'false') {
          return false as const;
        }
        return value;
      }),
    GOOGLE_CLIENT_ID: requiredSecret,
    GOOGLE_CLIENT_SECRET: requiredSecret,
    GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:5000/api/auth/google/callback'),
    GOOGLE_AUTH_URI: z.string().url().default('https://accounts.google.com/o/oauth2/v2/auth'),
    GOOGLE_TOKEN_URI: z.string().url().default('https://oauth2.googleapis.com/token'),
    GOOGLE_PROJECT_ID: optionalSecret,
    YOUTUBE_OAUTH_SCOPES: scopesSchema,
    TIKTOK_CLIENT_KEY: optionalSecret,
    TIKTOK_CLIENT_SECRET: optionalSecret,
    TIKTOK_REDIRECT_URI: optionalUrl,
    TIKTOK_OAUTH_SCOPES: tiktokScopesSchema,
    SOCIAL_TOKEN_ENCRYPTION_KEY: encryptionKeySchema,
    SESSION_SECRET: sessionSecretSchema,
    WORKSPACE_USER_EMAIL: z.string().email().default('local-workspace@social-media-analytics.local'),
  })
  .superRefine((data, ctx) => {
    rejectLocalhostInProduction('WEB_ORIGIN', data.WEB_ORIGIN, data.NODE_ENV, ctx);
    rejectLocalhostInProduction('GOOGLE_REDIRECT_URI', data.GOOGLE_REDIRECT_URI, data.NODE_ENV, ctx);
    requireHttpsInProduction('WEB_ORIGIN', data.WEB_ORIGIN, data.NODE_ENV, ctx);
    requireHttpsInProduction('GOOGLE_REDIRECT_URI', data.GOOGLE_REDIRECT_URI, data.NODE_ENV, ctx);
    rejectLocalhostInProduction('TIKTOK_REDIRECT_URI', data.TIKTOK_REDIRECT_URI, data.NODE_ENV, ctx);
    requireHttpsInProduction('TIKTOK_REDIRECT_URI', data.TIKTOK_REDIRECT_URI, data.NODE_ENV, ctx);
  });

export const workerEnvSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default('development'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    GOOGLE_CLIENT_ID: requiredSecret,
    GOOGLE_CLIENT_SECRET: requiredSecret,
    GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:5000/api/auth/google/callback'),
    YOUTUBE_OAUTH_SCOPES: scopesSchema,
    TIKTOK_CLIENT_KEY: optionalSecret,
    TIKTOK_CLIENT_SECRET: optionalSecret,
    TIKTOK_REDIRECT_URI: optionalUrl,
    TIKTOK_OAUTH_SCOPES: tiktokScopesSchema,
    SOCIAL_TOKEN_ENCRYPTION_KEY: encryptionKeySchema,
  })
  .superRefine((data, ctx) => {
    rejectLocalhostInProduction('GOOGLE_REDIRECT_URI', data.GOOGLE_REDIRECT_URI, data.NODE_ENV, ctx);
    requireHttpsInProduction('GOOGLE_REDIRECT_URI', data.GOOGLE_REDIRECT_URI, data.NODE_ENV, ctx);
    rejectLocalhostInProduction('TIKTOK_REDIRECT_URI', data.TIKTOK_REDIRECT_URI, data.NODE_ENV, ctx);
    requireHttpsInProduction('TIKTOK_REDIRECT_URI', data.TIKTOK_REDIRECT_URI, data.NODE_ENV, ctx);
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

export function parseApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = apiEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid API environment: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseWorkerEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const result = workerEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid worker environment: ${formatZodError(result.error)}`);
  }
  return result.data;
}
