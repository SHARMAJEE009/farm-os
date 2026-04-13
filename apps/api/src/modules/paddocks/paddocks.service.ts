import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class CreatePaddockDto {
  @IsUUID() farm_id: string;
  @IsString() name: string;
  @IsOptional() @IsString() crop_type?: string;
  @IsOptional() boundary_geojson?: object;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsNumber() land_area?: number;
  @IsOptional() @IsString() sowing_date?: string;
}

export class UpdatePaddockDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() crop_type?: string;
  @IsOptional() boundary_geojson?: object;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsNumber() land_area?: number;
  @IsOptional() @IsString() sowing_date?: string;
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
         (farm_id, name, crop_type, boundary_geojson,
          latitude, longitude, land_area, sowing_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        dto.farm_id,
        dto.name,
        dto.crop_type ?? null,
        dto.boundary_geojson ? JSON.stringify(dto.boundary_geojson) : null,
        dto.latitude ?? null,
        dto.longitude ?? null,
        dto.land_area ?? null,
        dto.sowing_date ?? null,
      ],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdatePaddockDto) {
    const p = await this.findOne(id);
    const { rows } = await this.db.query(
      `UPDATE paddocks
       SET name=$1, crop_type=$2, boundary_geojson=$3,
           latitude=$4, longitude=$5, land_area=$6, sowing_date=$7
       WHERE id=$8
       RETURNING *`,
      [
        dto.name !== undefined ? dto.name : p.name,
        dto.crop_type !== undefined ? dto.crop_type : p.crop_type,
        dto.boundary_geojson ? JSON.stringify(dto.boundary_geojson) : p.boundary_geojson,
        dto.latitude !== undefined ? dto.latitude : p.latitude,
        dto.longitude !== undefined ? dto.longitude : p.longitude,
        dto.land_area !== undefined ? dto.land_area : p.land_area,
        dto.sowing_date !== undefined ? dto.sowing_date : p.sowing_date,
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
