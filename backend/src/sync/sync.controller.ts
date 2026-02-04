import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('api/sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get()
  async getState(
    @Headers('x-user-id') userId: string | undefined,
    @Headers('x-user-email') userEmail: string | undefined,
  ) {
    return this.syncService.getState(userId ?? undefined, userEmail ?? undefined);
  }

  @Post()
  async postAction(
    @Headers('x-user-id') userId: string | undefined,
    @Headers('x-user-email') userEmail: string | undefined,
    @Body() body: { action: string; payload?: unknown; venue_id?: string },
  ) {
    return this.syncService.postAction(
      body.action,
      body.payload,
      body.venue_id,
      userId ?? undefined,
      userEmail ?? undefined,
    );
  }
}
