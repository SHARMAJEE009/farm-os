import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { MobAssignmentService } from './mob-assignment.service';
import { AssignPaddockDto, ExitPaddockDto } from './mob-assignment.dto';
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

  @Patch('livestock/mobs/:id/exit-paddock')
  @Roles('owner', 'manager')
  exitPaddock(@Param('id') mobId: string, @Body() dto: ExitPaddockDto) {
    return this.service.exitPaddock(mobId, dto);
  }

  @Get('paddocks/:id/active-mob')
  @Roles('owner', 'manager', 'staff', 'agronomist')
  findActiveMob(@Param('id') paddockId: string) {
    return this.service.findActiveMobForPaddock(paddockId);
  }
}
