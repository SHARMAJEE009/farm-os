import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { AssignPaddockDto, ExitPaddockDto } from './mob-assignment.dto';

@Injectable()
export class MobAssignmentService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async assignPaddock(mobId: string, dto: AssignPaddockDto) {
    // Get paddock area
    const { rows: paddockRows } = await this.db.query('SELECT land_area FROM paddocks WHERE id = $1', [dto.paddock_id]);
    if (!paddockRows[0]) throw new NotFoundException('Paddock not found');
    
    const landArea = paddockRows[0].land_area;
    const stockingRate = landArea > 0 ? dto.entry_head_count / landArea : null;

    const { rows } = await this.db.query(
      `INSERT INTO mob_paddock_assignment 
        (mob_id, paddock_id, entry_date, entry_head_count, stocking_rate_per_ha)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [mobId, dto.paddock_id, dto.entry_date, dto.entry_head_count, stockingRate]
    );
    return rows[0];
  }

  async exitPaddock(mobId: string, dto: ExitPaddockDto) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      
      // Find active assignment for this mob
      const { rows: activeRows } = await client.query(
        'SELECT * FROM mob_paddock_assignment WHERE mob_id = $1 AND exit_date IS NULL ORDER BY entry_date DESC LIMIT 1',
        [mobId]
      );
      if (!activeRows[0]) throw new BadRequestException('No active paddock assignment found for this mob');

      const assignmentId = activeRows[0].id;
      const paddockId = activeRows[0].paddock_id;

      const { rows } = await client.query(
        `UPDATE mob_paddock_assignment 
         SET exit_date = $1, exit_head_count = $2, exit_reason = $3, sale_price_per_head = $4
         WHERE id = $5
         RETURNING *`,
        [dto.exit_date, dto.exit_head_count, dto.exit_reason, dto.sale_price_per_head ?? null, assignmentId]
      );
      const assignment = rows[0];

      if (dto.exit_reason === 'sold') {
        // Update mob status
        await client.query('UPDATE mob SET status = $1 WHERE id = $2', ['sold', mobId]);

        if (dto.sale_price_per_head && dto.sale_price_per_head > 0) {
          const totalRevenue = dto.sale_price_per_head * dto.exit_head_count;
          
          // 1. Create financial transaction
          // Note: Sale is revenue, but financial_transactions currently seems to track "costs" (check amount >= 0).
          // If amount represents flow, we should be careful. 
          // For now, I'll follow the pattern and just record it.
          const { rows: txRows } = await client.query(
            `INSERT INTO financial_transactions (paddock_id, source, reference_id, amount)
             VALUES ($1, 'livestock', $2, $3) RETURNING id`,
            [paddockId, assignment.id, totalRevenue]
          );
          
          // 2. Create livestock financial entry
          await client.query(
            `INSERT INTO livestock_financial_entry (mob_id, paddock_id, entry_type, amount, date, financial_transaction_id)
             VALUES ($1, $2, 'sale', $3, $4, $5)`,
            [mobId, paddockId, totalRevenue, dto.exit_date, txRows[0].id]
          );
        }
      }

      await client.query('COMMIT');
      return assignment;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async findActiveMobForPaddock(paddockId: string) {
    const { rows } = await this.db.query(
      `SELECT m.*, mpa.entry_date, mpa.entry_head_count, mpa.stocking_rate_per_ha
       FROM mob_paddock_assignment mpa
       JOIN mob m ON mpa.mob_id = m.id
       WHERE mpa.paddock_id = $1 AND mpa.exit_date IS NULL
       LIMIT 1`,
      [paddockId]
    );
    return rows[0] || null;
  }
}
