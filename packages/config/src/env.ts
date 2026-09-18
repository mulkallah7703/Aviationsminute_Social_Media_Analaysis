import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);

const requiredSecret = z.string().trim().min(1);

const optionalSecret = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const DEFAULT_YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
];

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

const encryptionKeySchema = z
  .string()
  .trim()
  .min(32, 'SOCIAL_TOKEN_ENCRYPTION_KEY must be at least 32 characters');

const sessionSecretSchema = z
  .string()
  .trim()
  .min(32, 'SESSION_SECRET must be at least 32 characters');

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  API_PORT: z.coerce.number().int().positive().default(5000),
  API_HOST: z.string().default('0.0.0.0'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  GOOGLE_CLIENT_ID: requiredSecret,
  GOOGLE_CLIENT_SECRET: requiredSecret,
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:5000/api/auth/google/callback'),
  GOOGLE_AUTH_URI: z.string().url().default('https://accounts.google.com/o/oauth2/v2/auth'),
  GOOGLE_TOKEN_URI: z.string().url().default('https://oauth2.googleapis.com/token'),
  GOOGLE_PROJECT_ID: optionalSecret,
  YOUTUBE_OAUTH_SCOPES: scopesSchema,
  SOCIAL_TOKEN_ENCRYPTION_KEY: encryptionKeySchema,
  SESSION_SECRET: sessionSecretSchema,
  WORKSPACE_USER_EMAIL: z.string().email().default('local-workspace@social-media-analytics.local'),
});

export const workerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  GOOGLE_CLIENT_ID: requiredSecret,
  GOOGLE_CLIENT_SECRET: requiredSecret,
  GOOGLE_REDIRECT_URI: z.string().url().default('http://localhost:5000/api/auth/google/callback'),
  YOUTUBE_OAUTH_SCOPES: scopesSchema,
  SOCIAL_TOKEN_ENCRYPTION_KEY: encryptionKeySchema,
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
