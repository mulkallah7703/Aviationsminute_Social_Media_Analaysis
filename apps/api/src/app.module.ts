import { Module } from '@nestjs/common';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisInfrastructureModule } from './infrastructure/redis/redis.module';
import { ProvidersModule } from './infrastructure/providers/providers.module';
import { QueueInfrastructureModule } from './infrastructure/queue/queue.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { PlatformsModule } from './modules/platforms/platforms.module';
import { SocialAccountsModule } from './modules/social-accounts/social-accounts.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SyncModule } from './modules/sync/sync.module';
import { YoutubeModule } from './modules/youtube/youtube.module';
import { TikTokModule } from './modules/tiktok/tiktok.module';

@Module({
  imports: [
    DatabaseModule,
    RedisInfrastructureModule,
    ProvidersModule,
    QueueInfrastructureModule,
    HealthModule,
    AuthModule,
    PlatformsModule,
    SocialAccountsModule,
    AnalyticsModule,
    SyncModule,
    YoutubeModule,
    TikTokModule,
  ],
})
export class AppModule {}
