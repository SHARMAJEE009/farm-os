import { Module } from '@nestjs/common';
import { LivestockMasterController } from './livestock-master.controller';
import { LivestockMasterService } from './livestock-master.service';

@Module({
  controllers: [LivestockMasterController],
  providers: [LivestockMasterService],
  exports: [LivestockMasterService],
})
export class LivestockMasterModule {}
