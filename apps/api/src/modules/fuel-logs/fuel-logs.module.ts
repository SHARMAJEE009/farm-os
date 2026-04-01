import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsUUID, IsNumber, IsString, IsOptional, Min } from 'class-validator';
import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';

export class CreateFuelLogDto {
  @IsUUID() paddock_id: string;
  @IsNumber() @Min(0.1) litres: number;
  @IsNumber() @Min(0) price_per_litre: number;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsUUID() payment_id?: string;
}

@Injectable()
export class FuelLogsService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(paddockId?: string) {
    const sql = paddockId
      ? `SELECT f.*, p.name as paddock_name FROM fuel_logs f
         LEFT JOIN paddocks p ON p.id = f.paddock_id
         WHERE f.paddock_id = $1 ORDER BY f.date DESC`
      : `SELECT f.*, p.name as paddock_name FROM fuel_logs f
         LEFT JOIN paddocks p ON p.id = f.paddock_id
         ORDER BY f.date DESC`;
    const { rows } = await this.db.query(sql, paddockId ? [paddockId] : []);
    return rows.map(r => ({
      ...r,
      paddock: r.paddock_name ? { id: r.paddock_id, name: r.paddock_name } : null,
    }));
  }

  async findOne(id: string) {
    const { rows } = await this.db.query('SELECT * FROM fuel_logs WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundException('Fuel log not found');
    return rows[0];
  }

  async create(dto: CreateFuelLogDto) {
    const { rows } = await this.db.query(
      `INSERT INTO fuel_logs (paddock_id, litres, price_per_litre, date, payment_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [dto.paddock_id, dto.litres, dto.price_per_litre,
       dto.date ?? new Date().toISOString().split('T')[0], dto.payment_id ?? null],
    );
    await this.db.query(
      `INSERT INTO financial_transactions (paddock_id, source, reference_id, amount)
       VALUES ($1,'fuel',$2,$3)`,
      [dto.paddock_id, rows[0].id, rows[0].total_cost],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM fuel_logs WHERE id = $1', [id]);
    return { deleted: true };
  }
}

@ApiTags('fuel-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fuel-logs')
export class FuelLogsController {
  constructor(private readonly service: FuelLogsService) {}
  @Get()      findAll(@Query('paddock_id') pid?: string) { return this.service.findAll(pid); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post()     create(@Body() dto: CreateFuelLogDto) { return this.service.create(dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [FuelLogsController], providers: [FuelLogsService] })
export class FuelLogsModule {}
