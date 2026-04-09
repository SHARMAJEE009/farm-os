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
      this.db.query('SELECT COUNT(*), COALESCE(SUM(land_area),0) as total_ha FROM paddocks'),
      this.db.query(`
        SELECT COALESCE(SUM(amount),0) as total
        FROM financial_transactions
        WHERE created_at >= date_trunc('month', CURRENT_DATE)
      `),
      this.db.query(`SELECT COUNT(*) FROM recommendations WHERE status='draft'`),
      this.db.query(`SELECT COUNT(*) FROM supplier_orders WHERE status='pending'`),
      this.db.query(`
        SELECT ft.*,
          p.name as paddock_name,
          CASE WHEN ft.source = 'supplier' THEN so.product_name END as product_name,
          CASE WHEN ft.source = 'supplier' THEN sup_user.name END as supplier_name,
          CASE WHEN ft.source = 'labour' THEN COALESCE(labour_user.name, ts.staff_name) END as staff_name
        FROM financial_transactions ft
        LEFT JOIN paddocks p ON p.id = ft.paddock_id
        LEFT JOIN supplier_orders so ON so.id = ft.reference_id AND ft.source = 'supplier'
        LEFT JOIN users sup_user ON sup_user.id = so.supplier_id
        LEFT JOIN timesheets ts ON ts.id = ft.reference_id AND ft.source = 'labour'
        LEFT JOIN users labour_user ON labour_user.id = ts.user_id
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
        product_name: r.product_name ?? null,
        supplier_name: r.supplier_name ?? null,
        staff_name: r.staff_name ?? null,
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

  async getForecasting() {
    // Historical monthly data for last 12 months grouped by source
    const { rows: monthly } = await this.db.query(`
      SELECT
        TO_CHAR(date_trunc('month', created_at), 'YYYY-MM') as month,
        SUM(CASE WHEN source = 'labour' THEN amount ELSE 0 END) as labour,
        SUM(CASE WHEN source = 'fuel' THEN amount ELSE 0 END) as fuel,
        SUM(CASE WHEN source = 'supplier' THEN amount ELSE 0 END) as supplier,
        SUM(amount) as total
      FROM financial_transactions
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY date_trunc('month', created_at)
      ORDER BY date_trunc('month', created_at) ASC
    `);

    const historical = monthly.map(r => ({
      month: r.month,
      labour: parseFloat(r.labour),
      fuel: parseFloat(r.fuel),
      supplier: parseFloat(r.supplier),
      total: parseFloat(r.total),
      projected: false,
    }));

    // Compute 3-month average for projection
    const last3 = historical.slice(-3);
    const avgLabour   = last3.length ? last3.reduce((s, r) => s + r.labour, 0)   / last3.length : 0;
    const avgFuel     = last3.length ? last3.reduce((s, r) => s + r.fuel, 0)     / last3.length : 0;
    const avgSupplier = last3.length ? last3.reduce((s, r) => s + r.supplier, 0) / last3.length : 0;

    // Project next 3 months
    const projected = [];
    const now = new Date();
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      projected.push({
        month: monthStr,
        labour: Math.round(avgLabour * 100) / 100,
        fuel: Math.round(avgFuel * 100) / 100,
        supplier: Math.round(avgSupplier * 100) / 100,
        total: Math.round((avgLabour + avgFuel + avgSupplier) * 100) / 100,
        projected: true,
      });
    }

    // Paddock monthly totals
    const { rows: paddockMonthly } = await this.db.query(`
      SELECT
        ft.paddock_id,
        p.name as paddock_name,
        TO_CHAR(date_trunc('month', ft.created_at), 'YYYY-MM') as month,
        SUM(ft.amount) as total
      FROM financial_transactions ft
      LEFT JOIN paddocks p ON p.id = ft.paddock_id
      WHERE ft.created_at >= NOW() - INTERVAL '6 months'
      GROUP BY ft.paddock_id, p.name, date_trunc('month', ft.created_at)
      ORDER BY ft.paddock_id, date_trunc('month', ft.created_at)
    `);

    return {
      monthly: [...historical, ...projected],
      paddock_monthly: paddockMonthly.map(r => ({
        paddock_id: r.paddock_id,
        paddock_name: r.paddock_name,
        month: r.month,
        total: parseFloat(r.total),
      })),
      projection_basis: 'trailing_3_month_average',
    };
  }

  async getBenchmarking() {
    const { rows } = await this.db.query(`
      SELECT
        p.id, p.name, p.land_area, p.crop_type,
        COALESCE(SUM(CASE WHEN ft.source = 'labour' THEN ft.amount ELSE 0 END), 0) as labour_cost,
        COALESCE(SUM(CASE WHEN ft.source = 'fuel' THEN ft.amount ELSE 0 END), 0) as fuel_cost,
        COALESCE(SUM(CASE WHEN ft.source = 'supplier' THEN ft.amount ELSE 0 END), 0) as supplier_cost,
        COALESCE(SUM(ft.amount), 0) as total_cost
      FROM paddocks p
      LEFT JOIN financial_transactions ft ON ft.paddock_id = p.id
      GROUP BY p.id, p.name, p.land_area, p.crop_type
      ORDER BY total_cost DESC
    `);

    const paddocks = rows.map(r => ({
      id: r.id,
      name: r.name,
      land_area: r.land_area ? parseFloat(r.land_area) : null,
      crop_type: r.crop_type,
      labour_cost: parseFloat(r.labour_cost),
      fuel_cost: parseFloat(r.fuel_cost),
      supplier_cost: parseFloat(r.supplier_cost),
      total_cost: parseFloat(r.total_cost),
      cost_per_hectare: r.land_area && parseFloat(r.land_area) > 0
        ? Math.round(parseFloat(r.total_cost) / parseFloat(r.land_area) * 100) / 100
        : null,
    }));

    // Assign percentile scores based on cost per hectare (lower cost = higher score)
    const withHa = paddocks.filter(p => p.cost_per_hectare !== null).sort((a, b) => a.cost_per_hectare - b.cost_per_hectare);
    const result = paddocks.map(p => {
      const rank = withHa.findIndex(x => x.id === p.id);
      const percentile = withHa.length > 1 && rank >= 0
        ? Math.round((1 - rank / (withHa.length - 1)) * 100)
        : null;
      const total = p.total_cost;
      return {
        ...p,
        percentile,
        labour_pct: total > 0 ? Math.round(p.labour_cost / total * 100) : 0,
        fuel_pct:   total > 0 ? Math.round(p.fuel_cost   / total * 100) : 0,
        supplier_pct: total > 0 ? Math.round(p.supplier_cost / total * 100) : 0,
      };
    });

    // Industry benchmark (Australian broadacre average)
    const industryBenchmark = { cost_per_hectare: 320, labour_pct: 35, fuel_pct: 25, supplier_pct: 40 };

    return { paddocks: result, industry_benchmark: industryBenchmark };
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

  @Get('forecasting')
  getForecasting() { return this.service.getForecasting(); }

  @Get('benchmarking')
  getBenchmarking() { return this.service.getBenchmarking(); }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
