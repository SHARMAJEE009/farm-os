import {
  Controller, Post, Get, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SoilReportsService, ParsedSoilReport } from './soil-reports.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('soil-reports')
export class SoilReportsController {
  constructor(private readonly service: SoilReportsService) {}

  /** Upload a PDF, parse and return extracted data — does NOT save to DB */
  @Post('parse')
  @UseInterceptors(FileInterceptor('file'))
  async parse(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.service.parsePdf(file.buffer, file.originalname);
  }

  /** Save a soil report linked to a paddock */
  @Post()
  create(@Body() body: { paddock_id: string; farm_id?: string } & ParsedSoilReport) {
    const { paddock_id, farm_id, ...data } = body;
    return this.service.create(paddock_id, farm_id, data);
  }

  /** Get all soil reports for a paddock (latest first) */
  @Get()
  findAll(@Query('paddock_id') paddock_id: string) {
    return this.service.findByPaddock(paddock_id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
