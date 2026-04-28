import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { CreateHealthEventDto } from './health-event.dto';

@Injectable()
export class HealthEventService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAllForMob(mobId: string) {
    const { rows } = await this.db.query(
      'SELECT * FROM health_event WHERE mob_id = $1 ORDER BY date DESC',
      [mobId]
    );
    return rows;
  }

  async create(mobId: string, dto: CreateHealthEventDto) {
    const { rows } = await this.db.query(
      `INSERT INTO health_event 
        (mob_id, event_type, date, product_used, dose, withholding_period_days, whp_expiry_date, administered_by, head_count_affected, cause, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        mobId, dto.event_type, dto.date, dto.product_used ?? null, dto.dose ?? null, 
        dto.withholding_period_days ?? null, dto.whp_expiry_date ?? null, 
        dto.administered_by ?? null, dto.head_count_affected, dto.cause ?? null, dto.notes ?? null
      ]
    );
    return rows[0];
  }

  async findHealthAlerts() {
    const { rows } = await this.db.query(
      `SELECT m.name as mob_name, h.* 
       FROM health_event h
       JOIN mob m ON h.mob_id = m.id
       WHERE h.whp_expiry_date > CURRENT_DATE
       ORDER BY h.whp_expiry_date ASC`
    );
    return rows;
  }
}
