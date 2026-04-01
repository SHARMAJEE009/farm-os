import { Module } from '@nestjs/common';
import { PaddocksController } from './paddocks.controller';
import { PaddocksService } from './paddocks.service';

@Module({ controllers: [PaddocksController], providers: [PaddocksService] })
export class PaddocksModule {}
