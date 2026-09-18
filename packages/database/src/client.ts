import { PrismaClient } from '@prisma/client';

let prismaClient: PrismaClient | undefined;

export function createPrismaClient(databaseUrl: string): PrismaClient {
  if (prismaClient) {
    return prismaClient;
  }

  prismaClient = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return prismaClient;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (!prismaClient) {
    return;
  }

  await prismaClient.$disconnect();
  prismaClient = undefined;
}

export type { PrismaClient };
