import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  live() {
    return this.healthService.live();
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  ready() {
    return this.healthService.ready();
  }
}
