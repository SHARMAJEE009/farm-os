import { Module } from '@nestjs/common';
import { HealthEventController } from './health-event.controller';
import { HealthEventService } from './health-event.service';

@Module({
  controllers: [HealthEventController],
  providers: [HealthEventService],
  exports: [HealthEventService],
})
export class HealthEventModule {}
