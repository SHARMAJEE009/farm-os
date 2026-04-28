import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { CreateMobDto, UpdateMobStatusDto } from './mob.dto';

@Injectable()
export class MobService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(farmId: string, status?: string) {
    const query = status
      ? 'SELECT * FROM mob WHERE farm_id = $1 AND status = $2 ORDER BY created_at DESC'
      : 'SELECT * FROM mob WHERE farm_id = $1 ORDER BY created_at DESC';
    const params = status ? [farmId, status] : [farmId];
    const { rows } = await this.db.query(query, params);
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query(`
      SELECT m.*, 
             p.name as current_paddock_name,
             mpa.entry_date as current_entry_date,
             mpa.stocking_rate_per_ha
      FROM mob m
      LEFT JOIN LATERAL (
        SELECT paddock_id, entry_date, stocking_rate_per_ha
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
    const { rows } = await this.db.query(
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
    return rows[0];
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
