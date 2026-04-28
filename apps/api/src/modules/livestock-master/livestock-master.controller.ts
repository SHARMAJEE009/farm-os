import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { LivestockMasterService } from './livestock-master.service';
import { CreateSpeciesDto, CreateBreedDto, CreateAnimalClassDto } from './livestock-master.dto';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('livestock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('livestock')
export class LivestockMasterController {
  constructor(private readonly service: LivestockMasterService) {}

  @Get('species')
  @Roles('owner', 'manager', 'staff', 'agronomist')
  findAllSpecies() {
    return this.service.findAllSpecies();
  }

  @Post('species')
  @Roles('owner', 'manager')
  createSpecies(@Body() dto: CreateSpeciesDto) {
    return this.service.createSpecies(dto);
  }

  @Get('breeds')
  @Roles('owner', 'manager', 'staff', 'agronomist')
  findAllBreeds(@Query('species_id') speciesId?: string) {
    return this.service.findAllBreeds(speciesId);
  }

  @Post('breeds')
  @Roles('owner', 'manager')
  createBreed(@Body() dto: CreateBreedDto) {
    return this.service.createBreed(dto);
  }

  @Get('animal-classes')
  @Roles('owner', 'manager', 'staff', 'agronomist')
  findAllAnimalClasses(@Query('species_id') speciesId?: string) {
    return this.service.findAllAnimalClasses(speciesId);
  }

  @Post('animal-classes')
  @Roles('owner', 'manager')
  createAnimalClass(@Body() dto: CreateAnimalClassDto) {
    return this.service.createAnimalClass(dto);
  }
}
