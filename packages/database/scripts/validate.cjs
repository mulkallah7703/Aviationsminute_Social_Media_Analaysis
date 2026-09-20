const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { loadRootEnv } = require('./load-root-env.cjs');

loadRootEnv();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for prisma validate');
  process.exit(1);
}

const result = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'prisma', 'validate', '--schema', 'prisma/schema.prisma'],
  {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
    shell: true,
  },
);

process.exit(result.status ?? 1);
