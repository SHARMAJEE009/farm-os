import { Module } from '@nestjs/common';
import { MobController } from './mob.controller';
import { MobService } from './mob.service';

@Module({
  controllers: [MobController],
  providers: [MobService],
  exports: [MobService],
})
export class MobModule {}
