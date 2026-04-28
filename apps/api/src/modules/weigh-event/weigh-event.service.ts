import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { CreateWeighEventDto } from './weigh-event.dto';

@Injectable()
export class WeighEventService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAllForMob(mobId: string) {
    const { rows } = await this.db.query(
      'SELECT * FROM weigh_event WHERE mob_id = $1 ORDER BY date DESC',
      [mobId]
    );
    return rows;
  }

  async create(mobId: string, dto: CreateWeighEventDto) {
    // Get last weigh event for ADG calculation
    const { rows: lastRows } = await this.db.query(
      'SELECT average_weight_kg, date FROM weigh_event WHERE mob_id = $1 ORDER BY date DESC LIMIT 1',
      [mobId]
    );

    let adg = null;
    if (lastRows[0]) {
      const prevWeight = parseFloat(lastRows[0].average_weight_kg);
      const prevDate = new Date(lastRows[0].date);
      const currDate = new Date(dto.date);
      const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0) {
        adg = (dto.average_weight_kg - prevWeight) / diffDays;
      }
    }

    const { rows } = await this.db.query(
      `INSERT INTO weigh_event 
        (mob_id, date, head_count_weighed, average_weight_kg, adg_since_last_kg, notes, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [mobId, dto.date, dto.head_count_weighed, dto.average_weight_kg, adg, dto.notes ?? null, dto.recorded_by ?? null]
    );
    return rows[0];
  }
}
