const { PrismaClient } = require('@prisma/client');
const {
  loadRootEnv,
  assertDigitalSocialMediaUrl,
  getDatabaseName,
} = require('./load-root-env.cjs');

async function main() {
  loadRootEnv();
  assertDigitalSocialMediaUrl(process.env.DATABASE_URL);
  process.stdout.write(`ping target database: ${getDatabaseName(process.env.DATABASE_URL)}\n`);

  const prisma = new PrismaClient({ log: ['error', 'warn'] });
  try {
    const rows =
      await prisma.$queryRaw`SELECT DB_NAME() AS databaseName, @@SERVERNAME AS serverName`;
    process.stdout.write(`${JSON.stringify(rows)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.code ?? ''} ${error.message}\n`);
  process.exit(1);
});
