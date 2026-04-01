import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsString, IsEmail, IsEnum, IsOptional, IsUUID, MinLength } from 'class-validator';

export type UserRole = 'owner' | 'manager' | 'staff' | 'agronomist' | 'supplier';

export class CreateUserDto {
  @IsString() name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsEnum(['owner','manager','staff','agronomist','supplier']) role: UserRole;
  @IsOptional() @IsUUID() farm_id?: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(['owner','manager','staff','agronomist','supplier']) role?: UserRole;
  @IsOptional() @IsUUID() farm_id?: string;
}

@Injectable()
export class UsersService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async findAll(role?: string) {
    const query = role
      ? 'SELECT id, name, email, role, farm_id, created_at FROM users WHERE role = $1 ORDER BY name'
      : 'SELECT id, name, email, role, farm_id, created_at FROM users ORDER BY name';
    const { rows } = await this.db.query(query, role ? [role] : []);
    return rows;
  }

  async findOne(id: string) {
    const { rows } = await this.db.query(
      'SELECT id, name, email, role, farm_id, created_at FROM users WHERE id = $1', [id]);
    if (!rows[0]) throw new NotFoundException('User not found');
    return rows[0];
  }

  async create(dto: CreateUserDto) {
    const exists = await this.db.query('SELECT id FROM users WHERE email = $1', [dto.email]);
    if (exists.rows[0]) throw new ConflictException('Email already registered');
    const hash = await bcrypt.hash(dto.password, 12);
    const { rows } = await this.db.query(
      `INSERT INTO users (name, email, password_hash, role, farm_id)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, email, role, farm_id, created_at`,
      [dto.name, dto.email, hash, dto.role, dto.farm_id ?? null],
    );
    return rows[0];
  }

  async update(id: string, dto: UpdateUserDto) {
    const u = await this.findOne(id);
    const { rows } = await this.db.query(
      `UPDATE users SET name=$1, role=$2, farm_id=$3 WHERE id=$4
       RETURNING id, name, email, role, farm_id, created_at`,
      [dto.name ?? u.name, dto.role ?? u.role, dto.farm_id ?? u.farm_id, id],
    );
    return rows[0];
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.db.query('DELETE FROM users WHERE id = $1', [id]);
    return { deleted: true };
  }
}
