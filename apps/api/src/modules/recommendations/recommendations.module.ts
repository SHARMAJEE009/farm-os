import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsUUID, IsString, IsOptional, IsEnum } from 'class-validator';
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgronomyModule } from '../agronomy/agronomy.module';
import { AgronomyService } from '../agronomy/agronomy.service';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── DTOs ────────────────────────────────────────────────────────────────────

export class CreateRecommendationDto {
  @IsUUID() paddock_id: string;
  @IsOptional() @IsUUID() agronomist_id?: string;
  @IsString() type: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateStatusDto {
  @IsEnum(['draft', 'approved', 'rejected']) status: string;
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class RecommendationsService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(paddockId?: string, status?: string) {
    let sql = `SELECT r.*, p.name as paddock_name, u.name as agronomist_name
               FROM recommendations r
               LEFT JOIN paddocks p ON p.id = r.paddock_id
               LEFT JOIN users u ON u.id = r.agronomist_id`;
    const params: any[] = [];
    const conditions: string[] = [];
    if (paddockId) { params.push(paddockId); conditions.push(`r.paddock_id = $${params.length}`); }
    if (status)    { params.push(status);    conditions.push(`r.status = $${params.length}`); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY r.created_at DESC';
    const { rows } = await this.db.query(sql, params);
    return rows.map(r => ({
      ...r,
      paddock: r.paddock_name ? { id: r.paddock_id, name: r.paddock_name } : null,
      agronomist: r.agronomist_name ? { id: r.agronomist_id, name: r.agronomist_name } : null,
    }));
  }

  async findOne(id: string) {
    const { rows } = await this.db.query('SELECT * FROM recommendations WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundException('Recommendation not found');
    return rows[0];
  }

  async create(dto: CreateRecommendationDto) {
    const { rows } = await this.db.query(
      `INSERT INTO recommendations (paddock_id, agronomist_id, type, description)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [dto.paddock_id, dto.agronomist_id ?? null, dto.type, dto.description ?? null],
    );
    return rows[0];
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    await this.findOne(id);
    const { rows } = await this.db.query(
      'UPDATE recommendations SET status=$1 WHERE id=$2 RETURNING *',
      [dto.status, id],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM recommendations WHERE id = $1', [id]);
    return { deleted: true };
  }
}

// ── AI Recommendation Service ───────────────────────────────────────────────

@Injectable()
export class AiRecommendationService {
  private openaiApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly agronomyService: AgronomyService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
  }

  async generateRecommendation(soilReportId: string) {
    // 1. Find soil report
    const report = await this.agronomyService.getSoilReportById(soilReportId);
    if (!report) throw new NotFoundException('Soil report not found');
    if (report.status === 'ai_processed') {
      return report.ai_recommendation;
    }

    // 2. Update status to processing
    await this.agronomyService.updateSoilReportStatus(soilReportId, 'processing');

    try {
      // 3. Read PDF file
      const filePath = join(process.cwd(), report.file_path);
      const pdfBuffer = readFileSync(filePath);
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(pdfBuffer);
      const pdfText = pdfData.text;

      if (!pdfText || pdfText.trim().length < 20) {
        throw new BadRequestException('Could not extract meaningful text from the PDF');
      }

      // 4. Call OpenAI
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: this.openaiApiKey });

      const systemPrompt = `You are an expert agricultural agronomist AI for Australian farms.
Analyze the soil test report text and return ONLY a valid JSON object. No markdown. No explanation. Just JSON.
Required JSON structure:
{
  "paddockName": "${report.paddock_name || 'Unknown'}",
  "season": "${report.season || 'Unknown'}",
  "soilAlerts": [
    {
      "nutrient": "string",
      "value": "string",
      "status": "low|marginal|sufficient|high",
      "message": "string"
    }
  ],
  "fertiliserRecommendations": [
    {
      "timing": "string",
      "product": "string",
      "method": "string",
      "ratePerHa": 0,
      "totalQuantityTonnes": 0,
      "estimatedCostAUD": 0
    }
  ],
  "nutrientSummary": {
    "nitrogen": 0,
    "phosphorus": 0,
    "sulfur": 0,
    "zinc": 0
  },
  "cashflowImpact": [
    {
      "month": "string",
      "amountAUD": 0,
      "description": "string"
    }
  ],
  "expectedYield": {
    "low": 0,
    "expected": 0,
    "high": 0,
    "unit": "t/ha"
  },
  "roi": {
    "totalFertiliserCostAUD": 0,
    "expectedRevenueAUD": 0,
    "roiMultiple": 0
  },
  "summary": "string"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: pdfText },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const responseText = completion.choices[0]?.message?.content || '';

      // 5. Parse JSON response
      let recommendation: object;
      try {
        // Strip potential markdown fences
        const cleaned = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        recommendation = JSON.parse(cleaned);
      } catch {
        console.error('Failed to parse AI response:', responseText);
        await this.agronomyService.updateSoilReportStatus(soilReportId, 'failed');
        throw new BadRequestException('AI returned an invalid JSON response');
      }

      // 6. Save to database
      await this.agronomyService.updateSoilReportStatus(soilReportId, 'ai_processed', recommendation);

      return recommendation;
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      console.error('AI generation error:', err);
      await this.agronomyService.updateSoilReportStatus(soilReportId, 'failed');
      throw new BadRequestException('Failed to generate AI recommendation: ' + (err as Error).message);
    }
  }

  async viewRecommendation(soilReportId: string) {
    const report = await this.agronomyService.getSoilReportById(soilReportId);
    return report;
  }

  async getFarmReports(farmId: string) {
    return this.agronomyService.getSoilReportsByFarm(farmId);
  }
}

// ── Controller ──────────────────────────────────────────────────────────────

@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly service: RecommendationsService,
    private readonly aiService: AiRecommendationService,
  ) {}

  // ── Existing recommendation CRUD ────────────────────────────────────

  @Get()
  findAll(@Query('paddock_id') pid?: string, @Query('status') st?: string) {
    return this.service.findAll(pid, st);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateRecommendationDto) {
    return this.service.create(dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.service.updateStatus(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  // ── AI Soil Recommendation endpoints ────────────────────────────────

  @Post('generate/:soilReportId')
  @Roles('agronomist', 'manager', 'owner')
  async generateRecommendation(@Param('soilReportId') soilReportId: string) {
    return this.aiService.generateRecommendation(soilReportId);
  }

  @Get('view/:soilReportId')
  @Roles('agronomist', 'manager', 'owner')
  async viewRecommendation(@Param('soilReportId') soilReportId: string) {
    return this.aiService.viewRecommendation(soilReportId);
  }

  @Get('farm/:farmId')
  @Roles('manager', 'owner')
  async getFarmReports(@Param('farmId') farmId: string) {
    return this.aiService.getFarmReports(farmId);
  }
}

// ── Module ──────────────────────────────────────────────────────────────────

@Module({
  imports: [AgronomyModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, AiRecommendationService],
})
export class RecommendationsModule {}
