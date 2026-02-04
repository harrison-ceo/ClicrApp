import { Module } from '@nestjs/common';
import { LogErrorController } from './log-error.controller';
import { LogErrorService } from './log-error.service';

@Module({
  controllers: [LogErrorController],
  providers: [LogErrorService],
})
export class LogErrorModule {}
