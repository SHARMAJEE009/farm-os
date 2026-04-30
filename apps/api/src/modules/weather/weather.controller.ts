import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('weather')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('weather')
export class WeatherController {
  constructor(private readonly service: WeatherService) {}

  @Get()
  getWeather(@Query('farm_id') farmId: string) { return this.service.getWeather(farmId); }

  @Get('spray-conditions')
  getSprayConditions(@Query('farm_id') farmId: string) { return this.service.getSprayConditions(farmId); }
}
