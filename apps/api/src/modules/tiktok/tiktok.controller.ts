import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TikTokService } from './tiktok.service';

@Controller('tiktok')
export class TikTokController {
  constructor(private readonly tiktokService: TikTokService) {}

  @Get('connection')
  connection(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.tiktokService.getConnection(request, response);
  }

  @Get('analytics')
  analytics(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Query('preset') preset?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.tiktokService.getAnalytics(request, response, { preset, startDate, endDate });
  }

  @Get('sync/status')
  syncStatus(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.tiktokService.getSyncStatus(request, response);
  }

  @Post('sync')
  sync(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.tiktokService.requestSync(request, response);
  }

  @Get('connect')
  connect(@Res() response: Response): void {
    response.redirect('/api/auth/tiktok');
  }
}
