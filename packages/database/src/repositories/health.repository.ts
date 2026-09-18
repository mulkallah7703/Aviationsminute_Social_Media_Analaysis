import type { PrismaClient } from '@prisma/client';

interface DatabaseNameRow {
  databaseName: string | null;
}

export class HealthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ping(): Promise<boolean> {
    await this.prisma.$queryRaw`SELECT 1`;
    return true;
  }

  async currentDatabaseName(): Promise<string | null> {
    const rows = await this.prisma.$queryRaw<DatabaseNameRow[]>`SELECT DB_NAME() AS databaseName`;
    return rows[0]?.databaseName ?? null;
  }
}
