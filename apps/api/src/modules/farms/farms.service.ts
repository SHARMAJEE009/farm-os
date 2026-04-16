import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateFarmDto {
  @IsString() name: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postcode?: string;
  @IsOptional() @IsNumber() total_area_hectares?: number;
}

export class UpdateFarmDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postcode?: string;
  @IsOptional() @IsNumber() total_area_hectares?: number;
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
      `INSERT INTO farms (name, location, country, description, state, postcode, total_area_hectares)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        dto.name,
        dto.location ?? null,
        dto.country ?? 'Australia',
        dto.description ?? null,
        dto.state ?? null,
        dto.postcode ?? null,
        dto.total_area_hectares ?? null,
      ],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateFarmDto) {
    const farm = await this.findOne(id);
    const { rows } = await this.db.query(
      `UPDATE farms
       SET name = $1, location = $2, country = $3,
           description = $4, state = $5, postcode = $6,
           total_area_hectares = $7
       WHERE id = $8 RETURNING *`,
      [
        dto.name ?? farm.name,
        dto.location ?? farm.location,
        dto.country ?? farm.country,
        dto.description !== undefined ? dto.description : farm.description,
        dto.state !== undefined ? dto.state : farm.state,
        dto.postcode !== undefined ? dto.postcode : farm.postcode,
        dto.total_area_hectares !== undefined ? dto.total_area_hectares : farm.total_area_hectares,
        id,
      ],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM farms WHERE id = $1', [id]);
    return { deleted: true };
  }

  async getStats(id: string) {
    await this.findOne(id);

    const [paddocks, costs, recs, orders] = await Promise.all([
      this.db.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(land_area), 0) as total_ha FROM paddocks WHERE farm_id = $1`,
        [id],
      ),
      this.db.query(
        `SELECT COALESCE(SUM(ft.amount), 0) as total
         FROM financial_transactions ft
         JOIN paddocks p ON p.id = ft.paddock_id
         WHERE p.farm_id = $1 AND ft.created_at >= date_trunc('month', CURRENT_DATE)`,
        [id],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM recommendations r
         JOIN paddocks p ON p.id = r.paddock_id
         WHERE p.farm_id = $1 AND r.status = 'draft'`,
        [id],
      ),
      this.db.query(
        `SELECT COUNT(*) FROM supplier_orders so
         JOIN paddocks p ON p.id = so.paddock_id
         WHERE p.farm_id = $1 AND so.status = 'pending'`,
        [id],
      ),
    ]);

    return {
      paddock_count: parseInt(paddocks.rows[0].count),
      total_hectares: parseFloat(paddocks.rows[0].total_ha),
      cost_this_month: parseFloat(costs.rows[0].total),
      pending_recommendations: parseInt(recs.rows[0].count),
      pending_orders: parseInt(orders.rows[0].count),
    };
  }
}
