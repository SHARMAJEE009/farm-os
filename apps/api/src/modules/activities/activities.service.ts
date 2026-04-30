import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';

@Injectable()
export class ActivitiesService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(farmId?: string, paddockId?: string, type?: string) {
    let query = `
      SELECT a.*, p.name as paddock_name,
        COALESCE(
          json_agg(json_build_object(
            'id', ap.id, 'product_name', ap.product_name,
            'rate', ap.rate, 'rate_unit', ap.rate_unit,
            'total_quantity', ap.total_quantity, 'total_cost', ap.total_cost
          )) FILTER (WHERE ap.id IS NOT NULL), '[]'
        ) as products
      FROM activities a
      LEFT JOIN paddocks p ON a.paddock_id = p.id
      LEFT JOIN activity_products ap ON ap.activity_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (farmId) { query += ` AND a.farm_id = $${idx++}`; params.push(farmId); }
    if (paddockId) { query += ` AND a.paddock_id = $${idx++}`; params.push(paddockId); }
    if (type) { query += ` AND a.activity_type = $${idx++}`; params.push(type); }

    query += ` GROUP BY a.id, p.name ORDER BY COALESCE(a.completed_date, a.planned_date) DESC`;
    const { rows } = await this.db.query(query, params);
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query(`
      SELECT a.*, p.name as paddock_name
      FROM activities a
      LEFT JOIN paddocks p ON a.paddock_id = p.id
      WHERE a.id = $1
    `, [id]);
    if (!rows[0]) throw new NotFoundException('Activity not found');

    const { rows: products } = await this.db.query(
      'SELECT * FROM activity_products WHERE activity_id = $1', [id]
    );
    return { ...rows[0], products };
  }

  async create(dto: any) {
    const { products, ...activity } = dto;
    const { rows } = await this.db.query(
      `INSERT INTO activities
        (farm_id, paddock_id, crop_plan_id, recommendation_id, activity_type, status,
         planned_date, completed_date, operator_name, equipment,
         wind_speed_kmh, wind_direction, temperature_c, humidity_pct,
         area_applied_ha, water_rate_lha, notes, cost_amount, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        activity.farm_id, activity.paddock_id, activity.crop_plan_id ?? null,
        activity.recommendation_id ?? null, activity.activity_type,
        activity.status ?? 'planned', activity.planned_date ?? null,
        activity.completed_date ?? null, activity.operator_name ?? null,
        activity.equipment ?? null, activity.wind_speed_kmh ?? null,
        activity.wind_direction ?? null, activity.temperature_c ?? null,
        activity.humidity_pct ?? null, activity.area_applied_ha ?? null,
        activity.water_rate_lha ?? null, activity.notes ?? null,
        activity.cost_amount ?? null, activity.created_by ?? null,
      ],
    );

    if (products && Array.isArray(products)) {
      for (const p of products) {
        await this.db.query(
          `INSERT INTO activity_products
            (activity_id, product_id, product_name, rate, rate_unit, total_quantity, unit_cost, total_cost)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [rows[0].id, p.product_id ?? null, p.product_name, p.rate ?? null,
           p.rate_unit ?? null, p.total_quantity ?? null, p.unit_cost ?? null, p.total_cost ?? null],
        );
      }
    }
    return rows[0];
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    const { rows } = await this.db.query(
      `UPDATE activities SET
        activity_type=COALESCE($1, activity_type), status=COALESCE($2, status),
        planned_date=COALESCE($3, planned_date), completed_date=COALESCE($4, completed_date),
        operator_name=COALESCE($5, operator_name), equipment=COALESCE($6, equipment),
        wind_speed_kmh=COALESCE($7, wind_speed_kmh), wind_direction=COALESCE($8, wind_direction),
        temperature_c=COALESCE($9, temperature_c), humidity_pct=COALESCE($10, humidity_pct),
        area_applied_ha=COALESCE($11, area_applied_ha), water_rate_lha=COALESCE($12, water_rate_lha),
        notes=COALESCE($13, notes), cost_amount=COALESCE($14, cost_amount),
        updated_at=NOW()
       WHERE id=$15 RETURNING *`,
      [
        dto.activity_type, dto.status, dto.planned_date, dto.completed_date,
        dto.operator_name, dto.equipment, dto.wind_speed_kmh, dto.wind_direction,
        dto.temperature_c, dto.humidity_pct, dto.area_applied_ha, dto.water_rate_lha,
        dto.notes, dto.cost_amount, id,
      ],
    );
    return rows[0];
  }

  async complete(id: string, dto: any) {
    const { rows } = await this.db.query(
      `UPDATE activities SET status='completed', completed_date=COALESCE($1, CURRENT_DATE),
       operator_name=COALESCE($2, operator_name), notes=COALESCE($3, notes), updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [dto.completed_date, dto.operator_name, dto.notes, id],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM activities WHERE id = $1', [id]);
    return { deleted: true };
  }
}
