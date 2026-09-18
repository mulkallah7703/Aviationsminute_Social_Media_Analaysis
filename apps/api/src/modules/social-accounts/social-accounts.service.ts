import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SocialAccountRepository } from '@sma/database';
import type { SocialAccountListItem } from '@sma/types';
import { CurrentUserService } from '../auth/current-user.service';

function bigintToString(value: bigint | null | undefined): string | null {
  return value === null || value === undefined ? null : value.toString();
}

@Injectable()
export class SocialAccountsService {
  constructor(
    private readonly currentUser: CurrentUserService,
    private readonly socialAccountRepository: SocialAccountRepository,
  ) {}

  async list(request: Request, response: Response): Promise<{ data: SocialAccountListItem[] }> {
    try {
      const user = await this.currentUser.resolve(request, response);
      const accounts = await this.socialAccountRepository.findByUserId(user.userId);
      return {
        data: accounts.map((account) => ({
          id: account.socialAccountId.toString(),
          platformCode: account.platforms.platformCode,
          displayName: account.displayName,
          username: account.username,
          profileImageUrl: account.profileImageUrl,
          profileUrl: account.profileUrl,
          status: account.isConnected ? 'connected' : 'disconnected',
          subscribersCount: bigintToString(account.socialProfiles?.subscribersCount),
          totalViews: bigintToString(account.socialProfiles?.totalViews),
          totalPosts: bigintToString(account.socialProfiles?.totalPosts),
        })),
      };
    } catch {
      throw new ServiceUnavailableException({
        message: 'Database is unavailable.',
        messageAr: 'قاعدة البيانات غير متاحة.',
        database: 'disconnected',
      });
    }
  }
}
