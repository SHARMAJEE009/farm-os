import { Module } from '@nestjs/common';
import { WeighEventController } from './weigh-event.controller';
import { WeighEventService } from './weigh-event.service';

@Module({
  controllers: [WeighEventController],
  providers: [WeighEventService],
  exports: [WeighEventService],
})
export class WeighEventModule {}
