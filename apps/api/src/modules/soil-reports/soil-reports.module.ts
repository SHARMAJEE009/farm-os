import { Module } from '@nestjs/common';
import { SoilReportsController } from './soil-reports.controller';
import { SoilReportsService } from './soil-reports.service';

@Module({
  controllers: [SoilReportsController],
  providers: [SoilReportsService],
})
export class SoilReportsModule {}
