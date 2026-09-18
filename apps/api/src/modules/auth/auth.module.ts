import { Module } from '@nestjs/common';
import { SyncModule } from '../sync/sync.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CookieSessionService } from './cookie-session.service';
import { CurrentUserService } from './current-user.service';

@Module({
  imports: [SyncModule],
  controllers: [AuthController],
  providers: [AuthService, CookieSessionService, CurrentUserService],
  exports: [CurrentUserService],
})
export class AuthModule {}
