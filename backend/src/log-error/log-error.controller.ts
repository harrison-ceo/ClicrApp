import { Body, Controller, Headers, Post } from '@nestjs/common';
import { LogErrorService } from './log-error.service';

@Controller('api/log-error')
export class LogErrorController {
  constructor(private readonly logErrorService: LogErrorService) {}

  @Post()
  async log(
    @Headers('x-user-id') userId: string | undefined,
    @Body() body: { message: string; context?: string; payload?: unknown },
  ) {
    await this.logErrorService.log(userId ?? null, body.message, body.context ?? 'client_reported', body.payload);
    return { success: true };
  }
}
