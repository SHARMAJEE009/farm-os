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
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      const { rows } = await client.query(
        `INSERT INTO health_event 
          (mob_id, event_type, date, product_used, dose, withholding_period_days, whp_expiry_date, administered_by, head_count_affected, cause, notes, cost_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          mobId, dto.event_type, dto.date, dto.product_used ?? null, dto.dose ?? null, 
          dto.withholding_period_days ?? null, dto.whp_expiry_date ?? null, 
          dto.administered_by ?? null, dto.head_count_affected, dto.cause ?? null, dto.notes ?? null,
          dto.cost_amount ?? 0
        ]
      );
      const event = rows[0];

      if (dto.cost_amount && dto.cost_amount > 0) {
        // Find current paddock for this mob to assign the cost
        const { rows: assignment } = await client.query(
          `SELECT paddock_id FROM mob_paddock_assignment 
           WHERE mob_id = $1 AND exit_date IS NULL 
           ORDER BY entry_date DESC LIMIT 1`,
          [mobId]
        );
        const paddockId = assignment[0]?.paddock_id || null;

        // 1. Create financial transaction
        const { rows: txRows } = await client.query(
          `INSERT INTO financial_transactions (paddock_id, source, reference_id, amount)
           VALUES ($1, 'livestock', $2, $3) RETURNING id`,
          [paddockId, event.id, dto.cost_amount]
        );
        
        // 2. Create livestock financial entry
        await client.query(
          `INSERT INTO livestock_financial_entry (mob_id, paddock_id, entry_type, amount, date, financial_transaction_id)
           VALUES ($1, $2, 'treatment', $3, $4, $5)`,
          [mobId, paddockId, dto.cost_amount, dto.date, txRows[0].id]
        );
      }

      await client.query('COMMIT');
      return event;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
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
