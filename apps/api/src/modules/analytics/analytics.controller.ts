import { Controller, Get, Param } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  overview() {
    return this.analyticsService.overview();
  }

  @Get('account/:id')
  accountOverview(@Param('id') id: string) {
    return this.analyticsService.accountOverview(id);
  }
}
