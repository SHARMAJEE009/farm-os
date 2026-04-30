import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { CreateMobDto, UpdateMobStatusDto } from './mob.dto';

@Injectable()
export class MobService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(farmId: string, status?: string) {
    // Enhanced query: joins current paddock assignment so the frontend
    // can render mob locations on the map without N+1 queries
    const baseQuery = `
      SELECT m.*,
             p.name   AS current_paddock_name,
             p.id     AS current_paddock_id,
             mpa.entry_date AS current_entry_date,
             mpa.entry_head_count AS paddock_head_count,
             mpa.stocking_rate_per_ha
      FROM mob m
      LEFT JOIN LATERAL (
        SELECT paddock_id, entry_date, entry_head_count, stocking_rate_per_ha
        FROM mob_paddock_assignment
        WHERE mob_id = m.id AND exit_date IS NULL
        ORDER BY entry_date DESC
        LIMIT 1
      ) mpa ON true
      LEFT JOIN paddocks p ON mpa.paddock_id = p.id
      WHERE m.farm_id = $1
    `;
    const query = status
      ? baseQuery + ' AND m.status = $2 ORDER BY m.created_at DESC'
      : baseQuery + ' ORDER BY m.created_at DESC';
    const params = status ? [farmId, status] : [farmId];
    const { rows } = await this.db.query(query, params);
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query(`
      SELECT m.*, 
             p.name as current_paddock_name,
             p.id as current_paddock_id,
             mpa.entry_date as current_entry_date,
             mpa.entry_head_count as paddock_head_count,
             mpa.stocking_rate_per_ha
      FROM mob m
      LEFT JOIN LATERAL (
        SELECT paddock_id, entry_date, entry_head_count, stocking_rate_per_ha
        FROM mob_paddock_assignment
        WHERE mob_id = m.id AND exit_date IS NULL
        ORDER BY entry_date DESC
        LIMIT 1
      ) mpa ON true
      LEFT JOIN paddocks p ON mpa.paddock_id = p.id
      WHERE m.id = $1
    `, [id]);
    
    if (!rows[0]) throw new NotFoundException('Mob not found');
    return rows[0];
  }

  async create(dto: CreateMobDto) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      const { rows } = await client.query(
        `INSERT INTO mob 
          (name, species_id, breed_id, animal_class_id, head_count, dob_range_start, dob_range_end, source_farm, purchase_date, purchase_price_per_head, farm_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          dto.name, dto.species_id, dto.breed_id ?? null, dto.animal_class_id ?? null, 
          dto.head_count, dto.dob_range_start ?? null, dto.dob_range_end ?? null, 
          dto.source_farm ?? null, dto.purchase_date ?? null, dto.purchase_price_per_head ?? null, 
          dto.farm_id, dto.created_by ?? null
        ]
      );
      const mob = rows[0];

      if (dto.purchase_price_per_head && dto.purchase_price_per_head > 0) {
        const totalCost = dto.purchase_price_per_head * dto.head_count;
        
        const { rows: txRows } = await client.query(
          `INSERT INTO financial_transactions (source, reference_id, amount)
           VALUES ('livestock', $1, $2) RETURNING id`,
          [mob.id, totalCost]
        );
        
        await client.query(
          `INSERT INTO livestock_financial_entry (mob_id, entry_type, amount, date, financial_transaction_id)
           VALUES ($1, 'purchase', $2, $3, $4)`,
          [mob.id, totalCost, dto.purchase_date || new Date().toISOString().split('T')[0], txRows[0].id]
        );
      }

      await client.query('COMMIT');
      return mob;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async updateStatus(id: string, dto: UpdateMobStatusDto) {
    const mob = await this.findOne(id);
    const headCount = dto.head_count !== undefined ? dto.head_count : mob.head_count;
    
    const { rows } = await this.db.query(
      'UPDATE mob SET status = $1, head_count = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [dto.status, headCount, id]
    );
    return rows[0];
  }
}
