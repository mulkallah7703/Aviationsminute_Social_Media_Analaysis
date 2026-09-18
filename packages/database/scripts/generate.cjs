const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { loadRootEnv } = require('./load-root-env.cjs');

loadRootEnv();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'sqlserver://localhost:1433;database=DigitalSocialMedia;user=placeholder;password=placeholder;encrypt=true;trustServerCertificate=true';
}

const result = spawnSync(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'prisma', 'generate', '--schema', 'prisma/schema.prisma'],
  {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
    shell: true,
  },
);

process.exit(result.status ?? 1);
