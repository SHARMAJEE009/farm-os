import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import { DATABASE_POOL } from '../database/database.module';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_POOL) private db: Pool,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const { rows } = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email],
    );
    const user = rows[0];
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const { password_hash, ...result } = user;
    return result;
  }

  async login(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async getProfile(userId: string) {
    const { rows } = await this.db.query(
      'SELECT id, name, email, role, farm_id, created_at FROM users WHERE id = $1',
      [userId],
    );
    return rows[0];
  }
}
