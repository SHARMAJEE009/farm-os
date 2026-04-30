import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';

@Injectable()
export class HarvestService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(farmId?: string) {
    let query = `
      SELECT h.*, p.name as paddock_name, p.land_area
      FROM harvest_records h
      LEFT JOIN paddocks p ON h.paddock_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (farmId) { query += ' AND h.farm_id = $1'; params.push(farmId); }
    query += ' ORDER BY h.harvest_date DESC';
    const { rows } = await this.db.query(query, params);
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query(`
      SELECT h.*, p.name as paddock_name, p.land_area
      FROM harvest_records h
      LEFT JOIN paddocks p ON h.paddock_id = p.id
      WHERE h.id = $1
    `, [id]);
    if (!rows[0]) throw new NotFoundException('Harvest record not found');
    return rows[0];
  }

  async create(dto: any) {
    const { rows } = await this.db.query(
      `INSERT INTO harvest_records
        (farm_id, paddock_id, crop_plan_id, harvest_date, crop, yield_total,
         yield_unit, yield_per_ha, moisture_pct, grade, price_per_unit, total_revenue, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [dto.farm_id, dto.paddock_id, dto.crop_plan_id ?? null,
       dto.harvest_date, dto.crop ?? null, dto.yield_total ?? null,
       dto.yield_unit ?? 'tonnes', dto.yield_per_ha ?? null,
       dto.moisture_pct ?? null, dto.grade ?? null,
       dto.price_per_unit ?? null, dto.total_revenue ?? null, dto.notes ?? null],
    );

    // Update crop plan actual yield if linked
    if (dto.crop_plan_id && dto.yield_per_ha) {
      await this.db.query(
        `UPDATE crop_plans SET actual_yield_per_ha = $1, status = 'harvested', updated_at = NOW() WHERE id = $2`,
        [dto.yield_per_ha, dto.crop_plan_id],
      );
    }

    return rows[0];
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    const { rows } = await this.db.query(
      `UPDATE harvest_records SET
        harvest_date=COALESCE($1,harvest_date), crop=COALESCE($2,crop),
        yield_total=COALESCE($3,yield_total), yield_per_ha=COALESCE($4,yield_per_ha),
        moisture_pct=COALESCE($5,moisture_pct), grade=COALESCE($6,grade),
        price_per_unit=COALESCE($7,price_per_unit), total_revenue=COALESCE($8,total_revenue),
        notes=COALESCE($9,notes)
       WHERE id=$10 RETURNING *`,
      [dto.harvest_date, dto.crop, dto.yield_total, dto.yield_per_ha,
       dto.moisture_pct, dto.grade, dto.price_per_unit, dto.total_revenue,
       dto.notes, id],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM harvest_records WHERE id = $1', [id]);
    return { deleted: true };
  }

  async summary(farmId: string) {
    const { rows } = await this.db.query(`
      SELECT
        COUNT(*) as total_records,
        SUM(yield_total) as total_yield,
        SUM(total_revenue) as total_revenue,
        AVG(yield_per_ha) as avg_yield_per_ha,
        AVG(moisture_pct) as avg_moisture
      FROM harvest_records WHERE farm_id = $1
    `, [farmId]);
    return rows[0];
  }
}
