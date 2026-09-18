import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SocialAccountsService } from './social-accounts.service';

@Controller('social-accounts')
export class SocialAccountsController {
  constructor(private readonly socialAccountsService: SocialAccountsService) {}

  @Get()
  list(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.socialAccountsService.list(request, response);
  }
}
