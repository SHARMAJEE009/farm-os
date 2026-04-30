import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { HarvestService } from './harvest.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('harvest')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('harvest')
export class HarvestController {
  constructor(private readonly service: HarvestService) {}

  @Get()          findAll(@Query('farm_id') farmId?: string) { return this.service.findAll(farmId); }
  @Get('summary') summary(@Query('farm_id') farmId: string) { return this.service.summary(farmId); }
  @Get(':id')     findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post()         create(@Body() dto: any) { return this.service.create(dto); }
  @Patch(':id')   update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Delete(':id')  remove(@Param('id') id: string) { return this.service.remove(id); }
}
