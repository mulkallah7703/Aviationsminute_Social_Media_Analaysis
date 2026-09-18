import { Global, Module } from '@nestjs/common';
import {
  AccountMetricsRepository,
  AnalyticsPeriodCache,
  HealthRepository,
  MetricSnapshotRepository,
  PlatformRepository,
  SocialAccountRepository,
  SocialPostRepository,
  SocialTokenRepository,
  SyncJobRepository,
  UserRepository,
} from '@sma/database';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: PlatformRepository,
      useFactory: (prisma: PrismaService) => new PlatformRepository(prisma.instance),
      inject: [PrismaService],
    },
    {
      provide: SocialAccountRepository,
      useFactory: (prisma: PrismaService) => new SocialAccountRepository(prisma.instance),
      inject: [PrismaService],
    },
    {
      provide: UserRepository,
      useFactory: (prisma: PrismaService) => new UserRepository(prisma.instance),
      inject: [PrismaService],
    },
    {
      provide: HealthRepository,
      useFactory: (prisma: PrismaService) => new HealthRepository(prisma.instance),
      inject: [PrismaService],
    },
    {
      provide: SocialTokenRepository,
      useFactory: (prisma: PrismaService) => new SocialTokenRepository(prisma.instance),
      inject: [PrismaService],
    },
    {
      provide: AccountMetricsRepository,
      useFactory: (prisma: PrismaService) => new AccountMetricsRepository(prisma.instance),
      inject: [PrismaService],
    },
    {
      provide: MetricSnapshotRepository,
      useFactory: (prisma: PrismaService) => new MetricSnapshotRepository(prisma.instance),
      inject: [PrismaService],
    },
    {
      provide: SocialPostRepository,
      useFactory: (prisma: PrismaService) => new SocialPostRepository(prisma.instance),
      inject: [PrismaService],
    },
    {
      provide: SyncJobRepository,
      useFactory: (prisma: PrismaService) => new SyncJobRepository(prisma.instance),
      inject: [PrismaService],
    },
    {
      provide: AnalyticsPeriodCache,
      useValue: new AnalyticsPeriodCache(),
    },
  ],
  exports: [
    PrismaService,
    PlatformRepository,
    SocialAccountRepository,
    HealthRepository,
    UserRepository,
    SocialTokenRepository,
    AccountMetricsRepository,
    MetricSnapshotRepository,
    SocialPostRepository,
    SyncJobRepository,
    AnalyticsPeriodCache,
  ],
})
export class DatabaseModule {}
