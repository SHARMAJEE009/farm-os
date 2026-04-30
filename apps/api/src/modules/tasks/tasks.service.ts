import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';

@Injectable()
export class TasksService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(farmId?: string, status?: string) {
    let query = `
      SELECT t.*, p.name as paddock_name
      FROM tasks t
      LEFT JOIN paddocks p ON t.paddock_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;
    if (farmId) { query += ` AND t.farm_id = $${idx++}`; params.push(farmId); }
    if (status) { query += ` AND t.status = $${idx++}`; params.push(status); }
    query += ' ORDER BY CASE t.priority WHEN \'urgent\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 ELSE 4 END, t.due_date ASC NULLS LAST';
    const { rows } = await this.db.query(query, params);
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query(`
      SELECT t.*, p.name as paddock_name
      FROM tasks t LEFT JOIN paddocks p ON t.paddock_id = p.id
      WHERE t.id = $1
    `, [id]);
    if (!rows[0]) throw new NotFoundException('Task not found');
    return rows[0];
  }

  async create(dto: any) {
    const { rows } = await this.db.query(
      `INSERT INTO tasks
        (farm_id, paddock_id, title, description, task_type, priority, status,
         assigned_to, assigned_to_name, due_date, estimated_hours, activity_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [dto.farm_id, dto.paddock_id ?? null, dto.title, dto.description ?? null,
       dto.task_type ?? 'general', dto.priority ?? 'medium', dto.status ?? 'pending',
       dto.assigned_to ?? null, dto.assigned_to_name ?? null, dto.due_date ?? null,
       dto.estimated_hours ?? null, dto.activity_id ?? null, dto.notes ?? null,
       dto.created_by ?? null],
    );
    return rows[0];
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    const { rows } = await this.db.query(
      `UPDATE tasks SET
        title=COALESCE($1,title), description=COALESCE($2,description),
        task_type=COALESCE($3,task_type), priority=COALESCE($4,priority),
        status=COALESCE($5,status), assigned_to_name=COALESCE($6,assigned_to_name),
        due_date=COALESCE($7,due_date), estimated_hours=COALESCE($8,estimated_hours),
        actual_hours=COALESCE($9,actual_hours), notes=COALESCE($10,notes),
        completed_date=CASE WHEN $5='completed' THEN COALESCE(completed_date, CURRENT_DATE) ELSE completed_date END,
        updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [dto.title, dto.description, dto.task_type, dto.priority,
       dto.status, dto.assigned_to_name, dto.due_date, dto.estimated_hours,
       dto.actual_hours, dto.notes, id],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM tasks WHERE id = $1', [id]);
    return { deleted: true };
  }

  async stats(farmId: string) {
    const { rows } = await this.db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'assigned') as assigned,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE priority = 'urgent' AND status NOT IN ('completed','cancelled')) as urgent,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status NOT IN ('completed','cancelled')) as overdue
      FROM tasks WHERE farm_id = $1
    `, [farmId]);
    return rows[0];
  }
}
