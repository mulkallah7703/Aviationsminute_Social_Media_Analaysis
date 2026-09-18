const { PrismaClient } = require('@prisma/client');
const { loadRootEnv, assertDigitalSocialMediaUrl } = require('./load-root-env.cjs');

async function main() {
  loadRootEnv();
  assertDigitalSocialMediaUrl(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ log: ['error'] });

  try {
    const account = await prisma.socialAccounts.findFirst({
      where: { platformAccountId: 'UC89h0mTDpr4J3HUolO95pKw' },
      include: {
        accountMetrics: true,
        socialProfiles: true,
        _count: { select: { socialPosts: true, metricSnapshots: true, syncJobs: true } },
      },
    });
    if (!account) {
      throw new Error('Connected YouTube account was not found.');
    }

    const latestJob = await prisma.syncJobs.findFirst({
      where: { socialAccountId: account.socialAccountId },
      orderBy: { createdAt: 'desc' },
    });
    const snapshot = await prisma.metricSnapshots.findFirst({
      where: { socialAccountId: account.socialAccountId },
      orderBy: { snapshotDate: 'desc' },
    });
    const check = await prisma.$queryRaw`
      SELECT name
      FROM sys.check_constraints
      WHERE name IN (N'CK_AccountMetrics_NonNegative', N'CK_PostMetrics_NonNegative')
    `;

    const metrics = account.accountMetrics;
    console.log(
      JSON.stringify(
        {
          socialAccountId: account.socialAccountId.toString(),
          platformAccountId: account.platformAccountId,
          displayName: account.displayName,
          lastSyncedAt: account.lastSyncedAt,
          counts: account._count,
          latestJob: latestJob
            ? {
                syncJobId: latestJob.syncJobId.toString(),
                status: latestJob.status,
                errorMessage: latestJob.errorMessage,
                recordsFetched: latestJob.recordsFetched,
                recordsInserted: latestJob.recordsInserted,
                recordsUpdated: latestJob.recordsUpdated,
              }
            : null,
          accountMetrics: metrics && {
            subscribersCount: metrics.subscribersCount?.toString() ?? null,
            viewsCount: metrics.viewsCount?.toString() ?? null,
            likesCount: metrics.likesCount?.toString() ?? null,
            likesDelta: metrics.likesDelta?.toString() ?? null,
            commentsCount: metrics.commentsCount?.toString() ?? null,
            sharesCount: metrics.sharesCount?.toString() ?? null,
            engagementCount: metrics.engagementCount?.toString() ?? null,
            engagementDelta: metrics.engagementDelta?.toString() ?? null,
            watchTimeSeconds: metrics.watchTimeSeconds?.toString() ?? null,
            subscribersGained: metrics.subscribersGained?.toString() ?? null,
            subscribersLost: metrics.subscribersLost?.toString() ?? null,
            reachCount: metrics.reachCount?.toString() ?? null,
            impressionsCount: metrics.impressionsCount?.toString() ?? null,
          },
          latestSnapshot: snapshot && {
            snapshotDate: snapshot.snapshotDate,
            likesCount: snapshot.likesCount?.toString() ?? null,
            likesDelta: snapshot.likesDelta?.toString() ?? null,
            engagementCount: snapshot.engagementCount?.toString() ?? null,
            engagementDelta: snapshot.engagementDelta?.toString() ?? null,
          },
          preservedChecks: check.map((row) => row.name),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
});
