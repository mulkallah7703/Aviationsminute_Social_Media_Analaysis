export function parseRedisUrl(redisUrl: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
} {
  const parsed = new URL(redisUrl);
  const dbPath = parsed.pathname.replace('/', '');

  return {
    host: parsed.hostname || '127.0.0.1',
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: dbPath ? Number(dbPath) : undefined,
  };
}
