import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { TimesheetsService, CreateTimesheetDto } from './timesheets.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';

@ApiTags('timesheets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timesheets')
export class TimesheetsController {
  constructor(private readonly service: TimesheetsService) {}
  @Get()    findAll(@Query('paddock_id') pid?: string) { return this.service.findAll(pid); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post()   create(@Body() dto: CreateTimesheetDto, @Request() req: any) {
    return this.service.create({ ...dto, user_id: dto.user_id ?? req.user.sub });
  }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [TimesheetsController], providers: [TimesheetsService] })
export class TimesheetsModule {}
