import { Module } from '@nestjs/common';
import { CropPlansController } from './crop-plans.controller';
import { CropPlansService } from './crop-plans.service';

@Module({ controllers: [CropPlansController], providers: [CropPlansService] })
export class CropPlansModule {}
