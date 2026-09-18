import { Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { YoutubeService } from './youtube.service';

@Controller('youtube')
export class YoutubeController {
  constructor(private readonly youtubeService: YoutubeService) {}

  @Get('connection')
  connection(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.youtubeService.getConnection(request, response);
  }

  @Get('analytics')
  analytics(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Query('preset') preset?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.youtubeService.getAnalytics(request, response, { preset, startDate, endDate });
  }

  @Get('sync/status')
  syncStatus(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.youtubeService.getSyncStatus(request, response);
  }

  @Post('sync')
  sync(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.youtubeService.requestSync(request, response);
  }

  @Get('connect')
  connect(@Res() response: Response): void {
    response.redirect('/api/auth/google');
  }
}
