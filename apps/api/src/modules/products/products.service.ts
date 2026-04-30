import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';

@Injectable()
export class ProductsService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(farmId?: string, category?: string) {
    let query = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];
    let idx = 1;
    if (farmId) { query += ` AND (farm_id = $${idx++} OR farm_id IS NULL)`; params.push(farmId); }
    if (category) { query += ` AND category = $${idx++}`; params.push(category); }
    query += ' ORDER BY name ASC';
    const { rows } = await this.db.query(query, params);
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query('SELECT * FROM products WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundException('Product not found');
    return rows[0];
  }

  async create(dto: any) {
    const { rows } = await this.db.query(
      `INSERT INTO products
        (name, category, active_ingredient, manufacturer, unit, default_rate, rate_unit,
         withholding_period_days, reentry_interval_hours, signal_word, sds_url, notes, farm_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [dto.name, dto.category ?? 'chemical', dto.active_ingredient ?? null,
       dto.manufacturer ?? null, dto.unit ?? 'L', dto.default_rate ?? null,
       dto.rate_unit ?? null, dto.withholding_period_days ?? null,
       dto.reentry_interval_hours ?? null, dto.signal_word ?? null,
       dto.sds_url ?? null, dto.notes ?? null, dto.farm_id ?? null],
    );
    return rows[0];
  }

  async update(id: string, dto: any) {
    const p = await this.findOne(id);
    const { rows } = await this.db.query(
      `UPDATE products SET
        name=COALESCE($1,name), category=COALESCE($2,category),
        active_ingredient=COALESCE($3,active_ingredient), manufacturer=COALESCE($4,manufacturer),
        unit=COALESCE($5,unit), default_rate=COALESCE($6,default_rate),
        rate_unit=COALESCE($7,rate_unit), withholding_period_days=COALESCE($8,withholding_period_days),
        reentry_interval_hours=COALESCE($9,reentry_interval_hours),
        signal_word=COALESCE($10,signal_word), notes=COALESCE($11,notes)
       WHERE id=$12 RETURNING *`,
      [dto.name, dto.category, dto.active_ingredient, dto.manufacturer,
       dto.unit, dto.default_rate, dto.rate_unit, dto.withholding_period_days,
       dto.reentry_interval_hours, dto.signal_word, dto.notes, id],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM products WHERE id = $1', [id]);
    return { deleted: true };
  }
}
