import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class CreatePaddockDto {
  @IsUUID() farm_id: string;
  @IsString() name: string;
  @IsOptional() @IsNumber() area_hectares?: number;
  @IsOptional() @IsString() crop_type?: string;
  @IsOptional() boundary_geojson?: object;
}

export class UpdatePaddockDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() area_hectares?: number;
  @IsOptional() @IsString() crop_type?: string;
  @IsOptional() boundary_geojson?: object;
}

@Injectable()
export class PaddocksService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(farmId?: string) {
    const query = farmId
      ? 'SELECT * FROM paddocks WHERE farm_id = $1 ORDER BY created_at DESC'
      : 'SELECT * FROM paddocks ORDER BY created_at DESC';
    const params = farmId ? [farmId] : [];
    const { rows } = await this.db.query(query, params);
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query('SELECT * FROM paddocks WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundException('Paddock not found');
    return rows[0];
  }

  async create(dto: CreatePaddockDto) {
    const { rows } = await this.db.query(
      `INSERT INTO paddocks (farm_id, name, area_hectares, crop_type, boundary_geojson)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [dto.farm_id, dto.name, dto.area_hectares ?? null, dto.crop_type ?? null,
       dto.boundary_geojson ? JSON.stringify(dto.boundary_geojson) : null],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdatePaddockDto) {
    const p = await this.findOne(id);
    const { rows } = await this.db.query(
      `UPDATE paddocks SET name=$1, area_hectares=$2, crop_type=$3, boundary_geojson=$4
       WHERE id=$5 RETURNING *`,
      [dto.name ?? p.name, dto.area_hectares ?? p.area_hectares,
       dto.crop_type ?? p.crop_type,
       dto.boundary_geojson ? JSON.stringify(dto.boundary_geojson) : p.boundary_geojson,
       id],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM paddocks WHERE id = $1', [id]);
    return { deleted: true };
  }
}
