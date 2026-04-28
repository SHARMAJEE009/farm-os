import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { HealthEventService } from './health-event.service';
import { CreateHealthEventDto } from './health-event.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('health-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('livestock')
export class HealthEventController {
  constructor(private readonly service: HealthEventService) {}

  @Get('health-alerts')
  @Roles('owner', 'manager', 'staff', 'agronomist')
  findHealthAlerts() {
    return this.service.findHealthAlerts();
  }

  @Get('mobs/:id/health-events')
  @Roles('owner', 'manager', 'staff', 'agronomist')
  findAllForMob(@Param('id') mobId: string) {
    return this.service.findAllForMob(mobId);
  }

  @Post('mobs/:id/health-events')
  @Roles('owner', 'manager')
  create(@Param('id') mobId: string, @Body() dto: CreateHealthEventDto, @Request() req) {
    if (!dto.administered_by) dto.administered_by = req.user.sub;
    return this.service.create(mobId, dto);
  }
}
