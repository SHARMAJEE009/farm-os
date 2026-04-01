import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsString, IsOptional } from 'class-validator';

export class CreateFarmDto {
  @IsString() name: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() country?: string;
}

export class UpdateFarmDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() country?: string;
}

@Injectable()
export class FarmsService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll() {
    const { rows } = await this.db.query('SELECT * FROM farms ORDER BY created_at DESC');
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query('SELECT * FROM farms WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundException('Farm not found');
    return rows[0];
  }

  async create(dto: CreateFarmDto) {
    const { rows } = await this.db.query(
      `INSERT INTO farms (name, location, country) VALUES ($1, $2, $3) RETURNING *`,
      [dto.name, dto.location ?? null, dto.country ?? 'Australia'],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateFarmDto) {
    const farm = await this.findOne(id);
    const { rows } = await this.db.query(
      `UPDATE farms SET name = $1, location = $2, country = $3 WHERE id = $4 RETURNING *`,
      [dto.name ?? farm.name, dto.location ?? farm.location, dto.country ?? farm.country, id],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM farms WHERE id = $1', [id]);
    return { deleted: true };
  }
}
