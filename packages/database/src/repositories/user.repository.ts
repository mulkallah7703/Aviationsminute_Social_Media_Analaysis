import type { PrismaClient } from '@prisma/client';

export class UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(userId: bigint) {
    return this.prisma.users.findUnique({
      where: { userId },
    });
  }

  findByEmail(email: string) {
    return this.prisma.users.findUnique({
      where: { email },
    });
  }

  async ensureWorkspaceUser(email: string) {
    const existing = await this.findByEmail(email);
    if (existing) {
      return existing;
    }

    return this.prisma.users.create({
      data: {
        email,
        firstName: 'Workspace',
        lastName: 'User',
        isActive: true,
        emailVerified: false,
      },
    });
  }
}
