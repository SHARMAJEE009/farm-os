import { Module } from '@nestjs/common';
import { MobAssignmentController } from './mob-assignment.controller';
import { MobAssignmentService } from './mob-assignment.service';

@Module({
  controllers: [MobAssignmentController],
  providers: [MobAssignmentService],
  exports: [MobAssignmentService],
})
export class MobAssignmentModule {}
