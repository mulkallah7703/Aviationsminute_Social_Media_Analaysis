import type { PrismaClient } from '@prisma/client';

export class PlatformRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAll() {
    return this.prisma.platforms.findMany({
      orderBy: { platformId: 'asc' },
    });
  }

  findByCode(code: string) {
    return this.prisma.platforms.findUnique({
      where: { platformCode: code },
    });
  }

  count() {
    return this.prisma.platforms.count();
  }
}
