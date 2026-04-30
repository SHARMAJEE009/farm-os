import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly service: InventoryService) {}

  @Get()      findAll(@Query('farm_id') farmId?: string) { return this.service.findAll(farmId); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post()     create(@Body() dto: any) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: any) { return this.service.update(id, dto); }
  @Patch(':id/adjust') adjustStock(@Param('id') id: string, @Body() dto: any) { return this.service.adjustStock(id, dto); }
  @Get(':id/transactions') getTransactions(@Param('id') id: string) { return this.service.getTransactions(id); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
