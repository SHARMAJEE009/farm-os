import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { PaddocksService, CreatePaddockDto, UpdatePaddockDto } from './paddocks.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('paddocks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('paddocks')
export class PaddocksController {
  constructor(private readonly service: PaddocksService) {}

  @Get()    findAll(@Query('farm_id') farmId?: string) { return this.service.findAll(farmId); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post()   create(@Body() dto: CreatePaddockDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdatePaddockDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
