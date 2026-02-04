import { Body, Controller, Post } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('aggregate')
  async aggregate(@Body() body: { businessId: string; date: string }) {
    const result = await this.reportsService.aggregate(body.businessId, body.date);
    return result;
  }
}
