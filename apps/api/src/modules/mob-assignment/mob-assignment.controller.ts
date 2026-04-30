import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { MobAssignmentService } from './mob-assignment.service';
import { AssignPaddockDto, ExitPaddockDto, MoveMobDto } from './mob-assignment.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('mob-assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class MobAssignmentController {
  constructor(private readonly service: MobAssignmentService) {}

  @Post('livestock/mobs/:id/assign-paddock')
  @Roles('owner', 'manager')
  assignPaddock(@Param('id') mobId: string, @Body() dto: AssignPaddockDto) {
    return this.service.assignPaddock(mobId, dto);
  }

  @Post('livestock/mobs/:id/move')
  @Roles('owner', 'manager')
  moveMob(@Param('id') mobId: string, @Body() dto: MoveMobDto) {
    return this.service.moveMob(mobId, dto);
  }

  @Patch('livestock/mobs/:id/exit-paddock')
  @Roles('owner', 'manager')
  exitPaddock(@Param('id') mobId: string, @Body() dto: ExitPaddockDto) {
    return this.service.exitPaddock(mobId, dto);
  }

  @Get('livestock/mobs/:id/movement-history')
  @Roles('owner', 'manager', 'staff', 'agronomist')
  getMovementHistory(@Param('id') mobId: string) {
    return this.service.getMovementHistory(mobId);
  }

  @Get('paddocks/:id/active-mob')
  @Roles('owner', 'manager', 'staff', 'agronomist')
  findActiveMob(@Param('id') paddockId: string) {
    return this.service.findActiveMobForPaddock(paddockId);
  }

  @Get('livestock/mob-locations')
  @Roles('owner', 'manager', 'staff', 'agronomist')
  getMobLocations(@Query('farm_id') farmId: string) {
    return this.service.getActiveMobLocations(farmId);
  }
}
