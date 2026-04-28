import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { MobService } from './mob.service';
import { CreateMobDto, UpdateMobStatusDto } from './mob.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('mobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('livestock/mobs')
export class MobController {
  constructor(private readonly service: MobService) {}

  @Get()
  @Roles('owner', 'manager', 'staff', 'agronomist')
  findAll(@Query('farm_id') farmId: string, @Query('status') status?: string) {
    return this.service.findAll(farmId, status);
  }

  @Post()
  @Roles('owner', 'manager')
  create(@Body() dto: CreateMobDto, @Request() req) {
    dto.created_by = req.user.sub;
    return this.service.create(dto);
  }

  @Get(':id')
  @Roles('owner', 'manager', 'staff', 'agronomist')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('owner', 'manager')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateMobStatusDto) {
    return this.service.updateStatus(id, dto);
  }
}
