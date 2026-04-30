import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';

@Injectable()
export class CropPlansService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(farmId?: string) {
    let query = `
      SELECT cp.*, p.name as paddock_name, p.land_area, p.crop_type as current_crop
      FROM crop_plans cp
      LEFT JOIN paddocks p ON cp.paddock_id = p.id
    `;
    const params: any[] = [];
    if (farmId) { query += ' WHERE cp.farm_id = $1'; params.push(farmId); }
    query += ' ORDER BY cp.season DESC, p.name ASC';
    const { rows } = await this.db.query(query, params);
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query(`
      SELECT cp.*, p.name as paddock_name, p.land_area
      FROM crop_plans cp
      LEFT JOIN paddocks p ON cp.paddock_id = p.id
      WHERE cp.id = $1
    `, [id]);
    if (!rows[0]) throw new NotFoundException('Crop plan not found');
    return rows[0];
  }

  async create(dto: any) {
    const { rows } = await this.db.query(
      `INSERT INTO crop_plans
        (farm_id, paddock_id, season, planned_crop, planned_variety,
         target_yield_per_ha, target_yield_unit, estimated_revenue_per_ha,
         estimated_cost_per_ha, sowing_date, harvest_date, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [dto.farm_id, dto.paddock_id, dto.season, dto.planned_crop ?? null,
       dto.planned_variety ?? null, dto.target_yield_per_ha ?? null,
       dto.target_yield_unit ?? 't/ha', dto.estimated_revenue_per_ha ?? null,
       dto.estimated_cost_per_ha ?? null, dto.sowing_date ?? null,
       dto.harvest_date ?? null, dto.status ?? 'planned', dto.notes ?? null],
    );
    return rows[0];
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    const { rows } = await this.db.query(
      `UPDATE crop_plans SET
        season=COALESCE($1,season), planned_crop=COALESCE($2,planned_crop),
        planned_variety=COALESCE($3,planned_variety),
        target_yield_per_ha=COALESCE($4,target_yield_per_ha),
        estimated_revenue_per_ha=COALESCE($5,estimated_revenue_per_ha),
        estimated_cost_per_ha=COALESCE($6,estimated_cost_per_ha),
        actual_yield_per_ha=COALESCE($7,actual_yield_per_ha),
        actual_revenue_per_ha=COALESCE($8,actual_revenue_per_ha),
        sowing_date=COALESCE($9,sowing_date), harvest_date=COALESCE($10,harvest_date),
        status=COALESCE($11,status), notes=COALESCE($12,notes), updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [dto.season, dto.planned_crop, dto.planned_variety,
       dto.target_yield_per_ha, dto.estimated_revenue_per_ha,
       dto.estimated_cost_per_ha, dto.actual_yield_per_ha,
       dto.actual_revenue_per_ha, dto.sowing_date, dto.harvest_date,
       dto.status, dto.notes, id],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM crop_plans WHERE id = $1', [id]);
    return { deleted: true };
  }
}
