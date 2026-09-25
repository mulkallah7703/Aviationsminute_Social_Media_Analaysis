import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SyncModule } from '../sync/sync.module';
import { TikTokController } from './tiktok.controller';
import { TikTokService } from './tiktok.service';

@Module({
  imports: [AuthModule, SyncModule],
  controllers: [TikTokController],
  providers: [TikTokService],
  exports: [TikTokService],
})
export class TikTokModule {}
