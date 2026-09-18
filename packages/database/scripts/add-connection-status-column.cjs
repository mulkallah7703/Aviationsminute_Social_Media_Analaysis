const { PrismaClient } = require('@prisma/client');
const { loadRootEnv, assertDigitalSocialMediaUrl } = require('./load-root-env.cjs');

async function columnExists(prisma, columnName) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS present
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = N'social'
      AND TABLE_NAME = N'SocialAccounts'
      AND COLUMN_NAME = ${columnName}
  `;
  return rows.length > 0;
}

async function main() {
  loadRootEnv();
  assertDigitalSocialMediaUrl(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ log: ['error'] });

  try {
    if (!(await columnExists(prisma, 'ConnectionStatus'))) {
      await prisma.$executeRawUnsafe('ALTER TABLE social.SocialAccounts ADD ConnectionStatus NVARCHAR(50) NULL');
    }

    await prisma.$executeRawUnsafe(`
      UPDATE social.SocialAccounts
      SET ConnectionStatus = CASE
        WHEN ConnectionStatus IS NOT NULL THEN ConnectionStatus
        WHEN IsConnected = 1 THEN N'connected'
        WHEN EXISTS (
          SELECT 1
          FROM social.SocialTokens tokens
          WHERE tokens.SocialAccountId = social.SocialAccounts.SocialAccountId
            AND tokens.RefreshTokenEncrypted IS NOT NULL
        ) THEN N'reauth_required'
        ELSE N'disconnected'
      END
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE social.SocialAccounts
      SET IsConnected = 1
      WHERE ConnectionStatus IN (N'connected', N'reauth_required')
    `);

    console.log(
      JSON.stringify({
        status: 'ok',
        added: 'ConnectionStatus on SocialAccounts when missing',
        backfilled: 'connected / reauth_required / disconnected from existing IsConnected and tokens',
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
