const { PrismaClient } = require('@prisma/client');
const { loadRootEnv, assertDigitalSocialMediaUrl } = require('./load-root-env.cjs');

const TABLES = ['AccountMetrics', 'MetricSnapshots'];
const COLUMNS = ['LikesDelta', 'EngagementDelta'];

async function columnExists(prisma, tableName, columnName) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS present
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = N'social'
      AND TABLE_NAME = ${tableName}
      AND COLUMN_NAME = ${columnName}
  `;
  return rows.length > 0;
}

async function main() {
  loadRootEnv();
  assertDigitalSocialMediaUrl(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ log: ['error'] });

  try {
    for (const table of TABLES) {
      for (const column of COLUMNS) {
        if (!(await columnExists(prisma, table, column))) {
          await prisma.$executeRawUnsafe(`ALTER TABLE social.${table} ADD ${column} BIGINT NULL`);
        }
      }
    }

    console.log(
      JSON.stringify({
        status: 'ok',
        added: 'LikesDelta and EngagementDelta on AccountMetrics and MetricSnapshots when missing',
        existingConstraintPreserved: 'CK_AccountMetrics_NonNegative',
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
});
