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
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsNumber() land_area?: number;
  @IsOptional() @IsString() description?: string;
}

export class UpdatePaddockDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() area_hectares?: number;
  @IsOptional() @IsString() crop_type?: string;
  @IsOptional() boundary_geojson?: object;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsNumber() land_area?: number;
  @IsOptional() @IsString() description?: string;
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
      `INSERT INTO paddocks
         (farm_id, name, area_hectares, crop_type, boundary_geojson,
          country, city, latitude, longitude, land_area, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        dto.farm_id,
        dto.name,
        dto.area_hectares ?? null,
        dto.crop_type ?? null,
        dto.boundary_geojson ? JSON.stringify(dto.boundary_geojson) : null,
        dto.country ?? null,
        dto.city ?? null,
        dto.latitude ?? null,
        dto.longitude ?? null,
        dto.land_area ?? null,
        dto.description ?? null,
      ],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdatePaddockDto) {
    const p = await this.findOne(id);
    const { rows } = await this.db.query(
      `UPDATE paddocks
       SET name=$1, area_hectares=$2, crop_type=$3, boundary_geojson=$4,
           country=$5, city=$6, latitude=$7, longitude=$8, land_area=$9, description=$10
       WHERE id=$11
       RETURNING *`,
      [
        dto.name ?? p.name,
        dto.area_hectares ?? p.area_hectares,
        dto.crop_type ?? p.crop_type,
        dto.boundary_geojson ? JSON.stringify(dto.boundary_geojson) : p.boundary_geojson,
        dto.country ?? p.country,
        dto.city ?? p.city,
        dto.latitude ?? p.latitude,
        dto.longitude ?? p.longitude,
        dto.land_area ?? p.land_area,
        dto.description ?? p.description,
        id,
      ],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM paddocks WHERE id = $1', [id]);
    return { deleted: true };
  }
}
