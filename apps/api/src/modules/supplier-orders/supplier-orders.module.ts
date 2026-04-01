import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsUUID, IsString, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';

export class CreateSupplierOrderDto {
  @IsUUID() paddock_id: string;
  @IsOptional() @IsUUID() supplier_id?: string;
  @IsOptional() @IsUUID() recommendation_id?: string;
  @IsString() product_name: string;
  @IsNumber() @Min(0.01) quantity: number;
  @IsNumber() @Min(0) unit_price: number;
}

export class UpdateOrderStatusDto {
  @IsEnum(['pending', 'ordered', 'delivered']) status: string;
}

@Injectable()
export class SupplierOrdersService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(paddockId?: string, status?: string) {
    let sql = `SELECT o.*, p.name as paddock_name, u.name as supplier_name
               FROM supplier_orders o
               LEFT JOIN paddocks p ON p.id = o.paddock_id
               LEFT JOIN users u ON u.id = o.supplier_id`;
    const params: any[] = [];
    const conds: string[] = [];
    if (paddockId) { params.push(paddockId); conds.push(`o.paddock_id = $${params.length}`); }
    if (status)    { params.push(status);    conds.push(`o.status = $${params.length}`); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY o.created_at DESC';
    const { rows } = await this.db.query(sql, params);
    return rows.map(r => ({
      ...r,
      paddock: r.paddock_name ? { id: r.paddock_id, name: r.paddock_name } : null,
      supplier: r.supplier_name ? { id: r.supplier_id, name: r.supplier_name } : null,
    }));
  }

  async findOne(id: string) {
    const { rows } = await this.db.query('SELECT * FROM supplier_orders WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundException('Order not found');
    return rows[0];
  }

  async create(dto: CreateSupplierOrderDto) {
    const { rows } = await this.db.query(
      `INSERT INTO supplier_orders
         (paddock_id, supplier_id, recommendation_id, product_name, quantity, unit_price)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [dto.paddock_id, dto.supplier_id ?? null, dto.recommendation_id ?? null,
       dto.product_name, dto.quantity, dto.unit_price],
    );
    // Write financial transaction when created
    await this.db.query(
      `INSERT INTO financial_transactions (paddock_id, source, reference_id, amount)
       VALUES ($1,'supplier',$2,$3)`,
      [dto.paddock_id, rows[0].id, rows[0].total_price],
    );
    return rows[0];
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    await this.findOne(id);
    const { rows } = await this.db.query(
      'UPDATE supplier_orders SET status=$1 WHERE id=$2 RETURNING *',
      [dto.status, id],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM supplier_orders WHERE id = $1', [id]);
    return { deleted: true };
  }
}

@ApiTags('supplier-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('supplier-orders')
export class SupplierOrdersController {
  constructor(private readonly service: SupplierOrdersService) {}
  @Get()      findAll(@Query('paddock_id') pid?: string, @Query('status') st?: string) { return this.service.findAll(pid, st); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post()     create(@Body() dto: CreateSupplierOrderDto) { return this.service.create(dto); }
  @Patch(':id/status') updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) { return this.service.updateStatus(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [SupplierOrdersController], providers: [SupplierOrdersService] })
export class SupplierOrdersModule {}
