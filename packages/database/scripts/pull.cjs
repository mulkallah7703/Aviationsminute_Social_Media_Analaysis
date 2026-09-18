const { spawnSync } = require('node:child_process');
const path = require('node:path');
const {
  loadRootEnv,
  getDatabaseName,
  assertDigitalSocialMediaUrl,
} = require('./load-root-env.cjs');

loadRootEnv();
assertDigitalSocialMediaUrl(process.env.DATABASE_URL);

const databaseName = getDatabaseName(process.env.DATABASE_URL);
process.stdout.write(`Prisma db pull target database: ${databaseName}\n`);
process.stdout.write('This command is read-only introspection. It does not change SQL Server.\n');

const result = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'prisma', 'db', 'pull', '--schema', 'prisma/schema.prisma'],
  {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
    shell: true,
  },
);

process.exit(result.status ?? 1);
