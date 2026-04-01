import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsNumber, IsString, IsOptional, IsEnum, Min } from 'class-validator';
import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';

export class CreatePaymentDto {
  @IsNumber() @Min(0) amount: number;
  @IsOptional() @IsString() method?: string;
}

export class UpdatePaymentStatusDto {
  @IsEnum(['pending','completed','failed','refunded']) status: string;
}

@Injectable()
export class PaymentsService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll() {
    const { rows } = await this.db.query('SELECT * FROM payments ORDER BY created_at DESC');
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundException('Payment not found');
    return rows[0];
  }

  async create(dto: CreatePaymentDto) {
    const { rows } = await this.db.query(
      'INSERT INTO payments (amount, method) VALUES ($1,$2) RETURNING *',
      [dto.amount, dto.method ?? null],
    );
    return rows[0];
  }

  async updateStatus(id: string, dto: UpdatePaymentStatusDto) {
    await this.findOne(id);
    const paid_at = dto.status === 'completed' ? new Date().toISOString() : null;
    const { rows } = await this.db.query(
      'UPDATE payments SET status=$1, paid_at=$2 WHERE id=$3 RETURNING *',
      [dto.status, paid_at, id],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM payments WHERE id = $1', [id]);
    return { deleted: true };
  }
}

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}
  @Get()      findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post()     create(@Body() dto: CreatePaymentDto) { return this.service.create(dto); }
  @Patch(':id/status') updateStatus(@Param('id') id: string, @Body() dto: UpdatePaymentStatusDto) { return this.service.updateStatus(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}

@Module({ controllers: [PaymentsController], providers: [PaymentsService] })
export class PaymentsModule {}
