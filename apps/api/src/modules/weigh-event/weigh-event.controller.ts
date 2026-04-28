import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WeighEventService } from './weigh-event.service';
import { CreateWeighEventDto } from './weigh-event.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('weigh-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('livestock/mobs/:id/weigh-events')
export class WeighEventController {
  constructor(private readonly service: WeighEventService) {}

  @Get()
  @Roles('owner', 'manager', 'staff', 'agronomist')
  findAllForMob(@Param('id') mobId: string) {
    return this.service.findAllForMob(mobId);
  }

  @Post()
  @Roles('owner', 'manager')
  create(@Param('id') mobId: string, @Body() dto: CreateWeighEventDto, @Request() req) {
    if (!dto.recorded_by) dto.recorded_by = req.user.sub;
    return this.service.create(mobId, dto);
  }
}
