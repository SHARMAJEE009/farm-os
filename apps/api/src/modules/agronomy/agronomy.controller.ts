import {
  Controller, Post, Get, Delete, Param, UseInterceptors,
  UploadedFile, Body, Req, UseGuards, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AgronomyService } from './agronomy.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';

// Ensure uploads directories exist
const uploadsDir = join(process.cwd(), 'uploads');
const soilReportsDir = join(uploadsDir, 'soil-reports');
if (!existsSync(soilReportsDir)) {
  mkdirSync(soilReportsDir, { recursive: true });
}

@Controller('agronomy')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgronomyController {
  constructor(private readonly agronomyService: AgronomyService) {}

  // ── Existing agronomy_documents endpoints ──────────────────────────────

  @Post('documents/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    }),
  }))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('paddock_id') paddockId: string,
    @Body('document_type') documentType: string,
    @Req() req: any,
  ) {
    const fileUrl = `/uploads/${file.filename}`;
    const fileName = file.originalname;
    const userId = req.user.sub;
    return this.agronomyService.uploadDocument(paddockId, documentType, fileUrl, fileName, userId);
  }

  @Get('documents/:paddockId')
  async getDocuments(@Param('paddockId') paddockId: string) {
    return this.agronomyService.getDocumentsForPaddock(paddockId);
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string) {
    return this.agronomyService.deleteDocument(id);
  }

  // ── Soil Report Upload (agronomist only) ───────────────────────────────

  @Post('upload-soil-report')
  @Roles('agronomist', 'manager', 'owner')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/soil-reports',
      filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `soil-${uniqueSuffix}${ext}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (file.mimetype !== 'application/pdf') {
        return cb(new BadRequestException('Only PDF files are allowed'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  }))
  async uploadSoilReport(
    @UploadedFile() file: Express.Multer.File,
    @Body('paddock_id') paddockId: string,
    @Body('farm_id') farmId: string,
    @Body('season') season: string,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('PDF file is required');
    if (!paddockId || !farmId) throw new BadRequestException('paddock_id and farm_id are required');

    const filePath = `/uploads/soil-reports/${file.filename}`;
    const report = await this.agronomyService.createSoilReport(
      paddockId, farmId, season || '', filePath, file.originalname, req.user.sub,
    );

    return {
      id: report.id,
      fileName: report.file_name,
      paddockId: report.paddock_id,
      farmId: report.farm_id,
      season: report.season,
      status: report.status,
      createdAt: report.created_at,
    };
  }

  // ── My Uploads (agronomist only) ───────────────────────────────────────

  @Get('my-uploads')
  @Roles('agronomist')
  async getMyUploads(@Req() req: any) {
    return this.agronomyService.getMyUploads(req.user.sub);
  }

  // ── Soil Reports by Farm (manager/admin/owner) ─────────────────────────

  @Get('soil-reports/farm/:farmId')
  @Roles('manager', 'owner')
  async getSoilReportsByFarm(@Param('farmId') farmId: string) {
    return this.agronomyService.getSoilReportsByFarm(farmId);
  }

  // ── All Soil Reports (admin/owner only) ────────────────────────────────

  @Get('soil-reports/all')
  @Roles('owner')
  async getAllSoilReports() {
    return this.agronomyService.getAllSoilReports();
  }

  // ── View single Soil Report ────────────────────────────────────────────

  @Get('soil-reports/:id')
  @Roles('manager', 'owner')
  async getSoilReport(@Param('id') id: string) {
    return this.agronomyService.getSoilReportById(id);
  }
}
