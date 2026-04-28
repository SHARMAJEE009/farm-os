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
    // Find active assignment for this mob
    const { rows: activeRows } = await this.db.query(
      'SELECT * FROM mob_paddock_assignment WHERE mob_id = $1 AND exit_date IS NULL ORDER BY entry_date DESC LIMIT 1',
      [mobId]
    );
    if (!activeRows[0]) throw new BadRequestException('No active paddock assignment found for this mob');

    const assignmentId = activeRows[0].id;

    const { rows } = await this.db.query(
      `UPDATE mob_paddock_assignment 
       SET exit_date = $1, exit_head_count = $2, exit_reason = $3
       WHERE id = $4
       RETURNING *`,
      [dto.exit_date, dto.exit_head_count, dto.exit_reason, assignmentId]
    );
    return rows[0];
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
