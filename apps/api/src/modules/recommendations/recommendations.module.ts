import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsUUID, IsString, IsOptional, IsEnum } from 'class-validator';
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';

export class CreateRecommendationDto {
  @IsUUID() paddock_id: string;
  @IsOptional() @IsUUID() agronomist_id?: string;
  @IsString() type: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateStatusDto {
  @IsEnum(['draft', 'approved', 'rejected']) status: string;
}

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

@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly service: RecommendationsService) {}
  @Get()      findAll(@Query('paddock_id') pid?: string, @Query('status') st?: string) { return this.service.findAll(pid, st); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post()     create(@Body() dto: CreateRecommendationDto) { return this.service.create(dto); }
  @Patch(':id/status') updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) { return this.service.updateStatus(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [RecommendationsController], providers: [RecommendationsService] })
export class RecommendationsModule {}
