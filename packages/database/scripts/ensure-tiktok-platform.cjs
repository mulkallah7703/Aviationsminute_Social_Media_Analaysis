const { PrismaClient } = require('@prisma/client');
const { loadRootEnv, assertDigitalSocialMediaUrl } = require('./load-root-env.cjs');

async function main() {
  loadRootEnv();
  assertDigitalSocialMediaUrl(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ log: ['error'] });

  try {
    const existing = await prisma.$queryRaw`
      SELECT PlatformId AS platformId, PlatformCode AS platformCode
      FROM social.Platforms
      WHERE PlatformCode = N'tiktok'
    `;

    if (existing.length > 0) {
      console.log(JSON.stringify({ status: 'ok', action: 'exists', platformId: String(existing[0].platformId) }));
      return;
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO social.Platforms (PlatformCode, PlatformName, IsActive)
      VALUES (N'tiktok', N'TikTok', 1)
    `);

    const created = await prisma.$queryRaw`
      SELECT PlatformId AS platformId
      FROM social.Platforms
      WHERE PlatformCode = N'tiktok'
    `;

    console.log(
      JSON.stringify({
        status: 'ok',
        action: 'inserted',
        platformId: created[0] ? String(created[0].platformId) : null,
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
