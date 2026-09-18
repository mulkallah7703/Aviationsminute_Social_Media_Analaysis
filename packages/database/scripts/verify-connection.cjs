const { PrismaClient } = require('@prisma/client');
const {
  loadRootEnv,
  getDatabaseName,
  assertDigitalSocialMediaUrl,
} = require('./load-root-env.cjs');

async function main() {
  loadRootEnv();
  assertDigitalSocialMediaUrl(process.env.DATABASE_URL);

  const expectedDatabase = getDatabaseName(process.env.DATABASE_URL);
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: ['error'],
  });

  try {
    const pingRows = await prisma.$queryRaw`SELECT 1 AS ok, DB_NAME() AS databaseName`;
    const databaseName = pingRows[0]?.databaseName;
    const platformCount = await prisma.platforms.count();
    const platforms = await prisma.platforms.findMany({
      select: {
        platformId: true,
        platformCode: true,
        platformName: true,
        isActive: true,
      },
      orderBy: {
        platformId: 'asc',
      },
    });

    const report = {
      ping: pingRows[0]?.ok === 1 || pingRows[0]?.ok === 1n ? 'ok' : 'unexpected',
      expectedDatabase,
      connectedDatabase: databaseName,
      platformCount,
      platforms: platforms.map((platform) => ({
        id: Number(platform.platformId),
        code: platform.platformCode,
        name: platform.platformName,
        isActive: platform.isActive,
      })),
    };

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

    if (String(databaseName).toLowerCase() !== 'digitalsocialmedia') {
      throw new Error(`Connected to ${databaseName}, expected DigitalSocialMedia.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Database verification failed.'}\n`,
  );
  process.exit(1);
});
