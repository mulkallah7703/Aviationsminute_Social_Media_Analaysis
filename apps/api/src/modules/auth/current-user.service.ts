import type { Request, Response } from 'express';
import { Injectable } from '@nestjs/common';
import { parseApiEnv } from '@sma/config';
import { UserRepository } from '@sma/database';
import { CookieSessionService } from './cookie-session.service';

@Injectable()
export class CurrentUserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly cookies: CookieSessionService,
  ) {}

  async resolve(request: Request, response?: Response) {
    const cookieUserId = this.cookies.readUserId(request);
    if (cookieUserId) {
      const existing = await this.userRepository.findById(cookieUserId);
      if (existing?.isActive) {
        return existing;
      }
    }

    const env = parseApiEnv();
    const user = await this.userRepository.ensureWorkspaceUser(env.WORKSPACE_USER_EMAIL);
    if (response) {
      this.cookies.setUserId(response, user.userId);
    }
    return user;
  }
}
