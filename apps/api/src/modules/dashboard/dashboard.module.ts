import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';

@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async getStats() {
    const [farms, paddocks, costs, recs, orders, recentTx] = await Promise.all([
      this.db.query('SELECT COUNT(*) FROM farms'),
      this.db.query('SELECT COUNT(*), COALESCE(SUM(area_hectares),0) as total_ha FROM paddocks'),
      this.db.query(`
        SELECT COALESCE(SUM(amount),0) as total
        FROM financial_transactions
        WHERE created_at >= date_trunc('month', CURRENT_DATE)
      `),
      this.db.query(`SELECT COUNT(*) FROM recommendations WHERE status='draft'`),
      this.db.query(`SELECT COUNT(*) FROM supplier_orders WHERE status='pending'`),
      this.db.query(`
        SELECT ft.*, p.name as paddock_name
        FROM financial_transactions ft
        LEFT JOIN paddocks p ON p.id = ft.paddock_id
        ORDER BY ft.created_at DESC LIMIT 10
      `),
    ]);

    return {
      total_farms: parseInt(farms.rows[0].count),
      total_paddocks: parseInt(paddocks.rows[0].count),
      total_hectares: parseFloat(paddocks.rows[0].total_ha),
      total_cost_this_month: parseFloat(costs.rows[0].total),
      pending_recommendations: parseInt(recs.rows[0].count),
      pending_orders: parseInt(orders.rows[0].count),
      recent_transactions: recentTx.rows.map(r => ({
        ...r,
        paddock: r.paddock_name ? { id: r.paddock_id, name: r.paddock_name } : null,
      })),
    };
  }

  async getPaddockSummaries() {
    const { rows: paddocks } = await this.db.query('SELECT * FROM paddocks ORDER BY name');

    const summaries = await Promise.all(
      paddocks.map(async (p) => {
        const [labour, fuel, supplier, recs, orders] = await Promise.all([
          this.db.query(`SELECT COALESCE(SUM(amount),0) as total FROM financial_transactions WHERE paddock_id=$1 AND source='labour'`, [p.id]),
          this.db.query(`SELECT COALESCE(SUM(amount),0) as total FROM financial_transactions WHERE paddock_id=$1 AND source='fuel'`, [p.id]),
          this.db.query(`SELECT COALESCE(SUM(amount),0) as total FROM financial_transactions WHERE paddock_id=$1 AND source='supplier'`, [p.id]),
          this.db.query(`SELECT COUNT(*) FROM recommendations WHERE paddock_id=$1 AND status='draft'`, [p.id]),
          this.db.query(`SELECT COUNT(*) FROM supplier_orders WHERE paddock_id=$1 AND status='pending'`, [p.id]),
        ]);

        const labourCost   = parseFloat(labour.rows[0].total);
        const fuelCost     = parseFloat(fuel.rows[0].total);
        const supplierCost = parseFloat(supplier.rows[0].total);

        return {
          paddock: p,
          total_labour_cost:   labourCost,
          total_fuel_cost:     fuelCost,
          total_supplier_cost: supplierCost,
          total_cost:          labourCost + fuelCost + supplierCost,
          open_recommendations: parseInt(recs.rows[0].count),
          pending_orders:       parseInt(orders.rows[0].count),
        };
      }),
    );

    return summaries;
  }
}

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('stats')
  getStats() { return this.service.getStats(); }

  @Get('paddock-summaries')
  getPaddockSummaries() { return this.service.getPaddockSummaries(); }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
