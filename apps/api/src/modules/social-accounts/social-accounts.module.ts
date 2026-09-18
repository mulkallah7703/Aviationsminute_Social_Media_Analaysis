import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SocialAccountsController } from './social-accounts.controller';
import { SocialAccountsService } from './social-accounts.service';

@Module({
  imports: [AuthModule],
  controllers: [SocialAccountsController],
  providers: [SocialAccountsService],
})
export class SocialAccountsModule {}
