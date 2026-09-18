import { Controller, Param, Post } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('accounts/:id')
  enqueue(@Param('id') id: string) {
    return this.syncService.enqueueManualSync({
      socialAccountId: id,
      platformCode: 'youtube',
      jobType: 'full',
      reason: 'manual',
    });
  }
}
