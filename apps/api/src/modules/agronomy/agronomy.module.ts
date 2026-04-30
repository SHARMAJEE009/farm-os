import { Module } from '@nestjs/common';
import { AgronomyController } from './agronomy.controller';
import { AgronomyService } from './agronomy.service';

@Module({
  controllers: [AgronomyController],
  providers: [AgronomyService],
})
export class AgronomyModule {}
