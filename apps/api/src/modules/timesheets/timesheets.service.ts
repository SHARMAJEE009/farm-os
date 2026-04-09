import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsUUID, IsNumber, IsString, IsOptional, Min } from 'class-validator';

export class CreateTimesheetDto {
  @IsOptional() @IsUUID() user_id?: string;
  @IsOptional() @IsString() staff_name?: string;
  @IsUUID() paddock_id: string;
  @IsNumber() @Min(0.5) hours: number;
  @IsNumber() @Min(0) hourly_rate: number;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsUUID() payment_id?: string;
}

@Injectable()
export class TimesheetsService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(paddockId?: string) {
    const sql = paddockId
      ? `SELECT t.*, p.name as paddock_name, u.name as user_name
         FROM timesheets t
         LEFT JOIN paddocks p ON p.id = t.paddock_id
         LEFT JOIN users u ON u.id = t.user_id
         WHERE t.paddock_id = $1 ORDER BY t.date DESC`
      : `SELECT t.*, p.name as paddock_name, u.name as user_name
         FROM timesheets t
         LEFT JOIN paddocks p ON p.id = t.paddock_id
         LEFT JOIN users u ON u.id = t.user_id
         ORDER BY t.date DESC`;
    const { rows } = await this.db.query(sql, paddockId ? [paddockId] : []);
    return rows.map(r => {
      // Resolve display name: registered user takes priority, then manually entered name
      const displayName = r.user_name ?? r.staff_name ?? null;
      return {
        ...r,
        paddock: r.paddock_name ? { id: r.paddock_id, name: r.paddock_name } : null,
        user: displayName ? { id: r.user_id ?? null, name: displayName } : null,
      };
    });
  }

  async findOne(id: string) {
    const { rows } = await this.db.query('SELECT * FROM timesheets WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundException('Timesheet not found');
    return rows[0];
  }

  async create(dto: CreateTimesheetDto) {
    const { rows } = await this.db.query(
      `INSERT INTO timesheets (user_id, staff_name, paddock_id, hours, hourly_rate, date, payment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        dto.user_id ?? null,
        dto.staff_name ?? null,
        dto.paddock_id,
        dto.hours,
        dto.hourly_rate,
        dto.date ?? new Date().toISOString().split('T')[0],
        dto.payment_id ?? null,
      ],
    );
    // Write financial transaction
    await this.db.query(
      `INSERT INTO financial_transactions (paddock_id, source, reference_id, amount)
       VALUES ($1,'labour',$2,$3)`,
      [dto.paddock_id, rows[0].id, rows[0].total_cost],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM timesheets WHERE id = $1', [id]);
    return { deleted: true };
  }
}
