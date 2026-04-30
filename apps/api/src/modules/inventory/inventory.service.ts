import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';

@Injectable()
export class InventoryService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(farmId?: string) {
    let query = 'SELECT * FROM inventory WHERE 1=1';
    const params: any[] = [];
    if (farmId) { query += ' AND farm_id = $1'; params.push(farmId); }
    query += ' ORDER BY product_name ASC';
    const { rows } = await this.db.query(query, params);
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query('SELECT * FROM inventory WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundException('Inventory item not found');
    return rows[0];
  }

  async create(dto: any) {
    const { rows } = await this.db.query(
      `INSERT INTO inventory
        (farm_id, product_id, product_name, category, current_stock, unit,
         reorder_level, location, batch_number, expiry_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [dto.farm_id, dto.product_id ?? null, dto.product_name,
       dto.category ?? 'chemical', dto.current_stock ?? 0, dto.unit ?? 'L',
       dto.reorder_level ?? null, dto.location ?? null,
       dto.batch_number ?? null, dto.expiry_date ?? null],
    );
    return rows[0];
  }

  async update(id: string, dto: any) {
    await this.findOne(id);
    const { rows } = await this.db.query(
      `UPDATE inventory SET
        product_name=COALESCE($1,product_name), category=COALESCE($2,category),
        current_stock=COALESCE($3,current_stock), unit=COALESCE($4,unit),
        reorder_level=COALESCE($5,reorder_level), location=COALESCE($6,location),
        batch_number=COALESCE($7,batch_number), expiry_date=COALESCE($8,expiry_date),
        last_updated=NOW()
       WHERE id=$9 RETURNING *`,
      [dto.product_name, dto.category, dto.current_stock, dto.unit,
       dto.reorder_level, dto.location, dto.batch_number, dto.expiry_date, id],
    );
    return rows[0];
  }

  async adjustStock(id: string, dto: any) {
    const item = await this.findOne(id);
    const newStock = parseFloat(item.current_stock) + parseFloat(dto.quantity);
    await this.db.query(
      `INSERT INTO inventory_transactions (inventory_id, activity_id, transaction_type, quantity, notes, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, dto.activity_id ?? null, dto.transaction_type, dto.quantity, dto.notes ?? null, dto.recorded_by ?? null],
    );
    const { rows } = await this.db.query(
      'UPDATE inventory SET current_stock=$1, last_updated=NOW() WHERE id=$2 RETURNING *',
      [newStock, id],
    );
    return rows[0];
  }

  async getTransactions(id: string) {
    const { rows } = await this.db.query(
      'SELECT * FROM inventory_transactions WHERE inventory_id = $1 ORDER BY created_at DESC', [id]
    );
    return rows;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM inventory WHERE id = $1', [id]);
    return { deleted: true };
  }
}
