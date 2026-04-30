import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { AssignPaddockDto, ExitPaddockDto, MoveMobDto } from './mob-assignment.dto';

@Injectable()
export class MobAssignmentService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async assignPaddock(mobId: string, dto: AssignPaddockDto) {
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
        await client.query('UPDATE mob SET status = $1 WHERE id = $2', ['sold', mobId]);

        if (dto.sale_price_per_head && dto.sale_price_per_head > 0) {
          const totalRevenue = dto.sale_price_per_head * dto.exit_head_count;
          
          const { rows: txRows } = await client.query(
            `INSERT INTO financial_transactions (paddock_id, source, reference_id, amount)
             VALUES ($1, 'livestock', $2, $3) RETURNING id`,
            [paddockId, assignment.id, totalRevenue]
          );
          
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

  /**
   * Move a mob from its current paddock to a new paddock in a single transaction.
   * Supports "gate splits" — moving only part of the herd.
   */
  async moveMob(mobId: string, dto: MoveMobDto) {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // 1. Find current active assignment
      const { rows: activeRows } = await client.query(
        'SELECT * FROM mob_paddock_assignment WHERE mob_id = $1 AND exit_date IS NULL ORDER BY entry_date DESC LIMIT 1',
        [mobId]
      );
      if (!activeRows[0]) throw new BadRequestException('Mob is not currently assigned to a paddock');
      const currentAssignment = activeRows[0];

      // 2. Validate head count
      if (dto.head_count > currentAssignment.entry_head_count) {
        throw new BadRequestException(
          `Cannot move ${dto.head_count} head — only ${currentAssignment.entry_head_count} in current paddock`
        );
      }

      // 3. Get destination paddock area for stocking rate
      const { rows: destRows } = await client.query(
        'SELECT land_area FROM paddocks WHERE id = $1', [dto.destination_paddock_id]
      );
      if (!destRows[0]) throw new NotFoundException('Destination paddock not found');
      const destArea = destRows[0].land_area;
      const newStockingRate = destArea > 0 ? dto.head_count / destArea : null;

      const isFullMove = dto.head_count >= currentAssignment.entry_head_count;

      if (isFullMove) {
        // Full move — close current assignment, open new one
        await client.query(
          `UPDATE mob_paddock_assignment 
           SET exit_date = $1, exit_head_count = $2, exit_reason = 'moved'
           WHERE id = $3`,
          [dto.move_date, dto.head_count, currentAssignment.id]
        );
      } else {
        // Gate split — reduce current assignment head count
        const remaining = currentAssignment.entry_head_count - dto.head_count;
        await client.query(
          `UPDATE mob_paddock_assignment SET entry_head_count = $1,
           stocking_rate_per_ha = CASE WHEN (SELECT land_area FROM paddocks WHERE id = $2) > 0 
             THEN $1::numeric / (SELECT land_area FROM paddocks WHERE id = $2) ELSE NULL END
           WHERE id = $3`,
          [remaining, currentAssignment.paddock_id, currentAssignment.id]
        );
        // Update mob head_count on the mob table
        await client.query(
          'UPDATE mob SET head_count = head_count - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [dto.head_count, mobId]
        );
      }

      // 4. Create new assignment at destination
      const { rows: newRows } = await client.query(
        `INSERT INTO mob_paddock_assignment 
          (mob_id, paddock_id, entry_date, entry_head_count, stocking_rate_per_ha)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [mobId, dto.destination_paddock_id, dto.move_date, dto.head_count, newStockingRate]
      );

      await client.query('COMMIT');
      return {
        moved: newRows[0],
        type: isFullMove ? 'full_move' : 'gate_split',
        head_moved: dto.head_count,
        source_paddock_id: currentAssignment.paddock_id,
        destination_paddock_id: dto.destination_paddock_id,
      };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /** Get full movement history for a mob */
  async getMovementHistory(mobId: string) {
    const { rows } = await this.db.query(
      `SELECT mpa.*, p.name as paddock_name, p.land_area as paddock_area
       FROM mob_paddock_assignment mpa
       JOIN paddocks p ON mpa.paddock_id = p.id
       WHERE mpa.mob_id = $1
       ORDER BY mpa.entry_date DESC, mpa.created_at DESC`,
      [mobId]
    );
    return rows;
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

  /** Get all active mob locations for a farm (for map overlays) */
  async getActiveMobLocations(farmId: string) {
    const { rows } = await this.db.query(
      `SELECT m.id as mob_id, m.name as mob_name, m.head_count,
              mpa.paddock_id, p.name as paddock_name,
              mpa.entry_date, mpa.stocking_rate_per_ha
       FROM mob m
       JOIN mob_paddock_assignment mpa ON mpa.mob_id = m.id AND mpa.exit_date IS NULL
       JOIN paddocks p ON mpa.paddock_id = p.id
       WHERE m.farm_id = $1 AND m.status = 'active'
       ORDER BY m.name`,
      [farmId]
    );
    return rows;
  }
}
