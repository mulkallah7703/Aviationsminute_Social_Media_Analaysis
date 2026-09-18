const { PrismaClient } = require('@prisma/client');
const { loadRootEnv, assertDigitalSocialMediaUrl } = require('./load-root-env.cjs');

const TARGETS = [
  { table: 'AccountMetrics', constraint: 'CK_AccountMetrics_SubscriberDeltas_NonNegative' },
  { table: 'MetricSnapshots', constraint: 'CK_MetricSnapshots_SubscriberDeltas_NonNegative' },
];

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

async function constraintExists(prisma, constraintName) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS present
    FROM sys.check_constraints
    WHERE name = ${constraintName}
  `;
  return rows.length > 0;
}

async function main() {
  loadRootEnv();
  assertDigitalSocialMediaUrl(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ log: ['error'] });

  try {
    for (const target of TARGETS) {
      const hasGained = await columnExists(prisma, target.table, 'SubscribersGained');
      const hasLost = await columnExists(prisma, target.table, 'SubscribersLost');

      if (!hasGained) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE social.${target.table} ADD SubscribersGained BIGINT NULL`,
        );
      }
      if (!hasLost) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE social.${target.table} ADD SubscribersLost BIGINT NULL`,
        );
      }
      if (!(await constraintExists(prisma, target.constraint))) {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE social.${target.table} ADD CONSTRAINT ${target.constraint} CHECK (
            ([SubscribersGained] IS NULL OR [SubscribersGained] >= (0)) AND
            ([SubscribersLost] IS NULL OR [SubscribersLost] >= (0))
          )`,
        );
      }
    }

    console.log(
      JSON.stringify({
        status: 'ok',
        added: 'SubscribersGained and SubscribersLost on AccountMetrics and MetricSnapshots when missing',
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
