import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsUUID, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';
import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';

export class CreateFinancialTransactionDto {
  @IsUUID() paddock_id: string;
  @IsEnum(['labour','fuel','supplier']) source: string;
  @IsOptional() @IsUUID() reference_id?: string;
  @IsNumber() @Min(0) amount: number;
}

@Injectable()
export class FinancialTransactionsService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(paddockId?: string, source?: string) {
    let sql = `SELECT ft.*, p.name as paddock_name
               FROM financial_transactions ft
               LEFT JOIN paddocks p ON p.id = ft.paddock_id`;
    const params: any[] = [];
    const conds: string[] = [];
    if (paddockId) { params.push(paddockId); conds.push(`ft.paddock_id = $${params.length}`); }
    if (source)    { params.push(source);    conds.push(`ft.source = $${params.length}`); }
    if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
    sql += ' ORDER BY ft.created_at DESC';
    const { rows } = await this.db.query(sql, params);
    return rows.map(r => ({
      ...r,
      paddock: r.paddock_name ? { id: r.paddock_id, name: r.paddock_name } : null,
    }));
  }

  async findOne(id: string) {
    const { rows } = await this.db.query('SELECT * FROM financial_transactions WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundException('Transaction not found');
    return rows[0];
  }

  async create(dto: CreateFinancialTransactionDto) {
    const { rows } = await this.db.query(
      `INSERT INTO financial_transactions (paddock_id, source, reference_id, amount)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [dto.paddock_id, dto.source, dto.reference_id ?? null, dto.amount],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM financial_transactions WHERE id = $1', [id]);
    return { deleted: true };
  }
}

@ApiTags('financial-transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('financial-transactions')
export class FinancialTransactionsController {
  constructor(private readonly service: FinancialTransactionsService) {}
  @Get()      findAll(@Query('paddock_id') pid?: string, @Query('source') src?: string) { return this.service.findAll(pid, src); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post()     create(@Body() dto: CreateFinancialTransactionDto) { return this.service.create(dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [FinancialTransactionsController], providers: [FinancialTransactionsService] })
export class FinancialTransactionsModule {}
