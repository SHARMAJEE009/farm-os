import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';

// Helper: build a farm-scoped WHERE clause for paddock-joined queries
function farmFilter(farmId: string | undefined) {
  return farmId ? `AND p.farm_id = '${farmId.replace(/'/g, "''")}'` : '';
}
function paddockFarmFilter(farmId: string | undefined) {
  return farmId ? `WHERE farm_id = '${farmId.replace(/'/g, "''")}'` : '';
}

@Injectable()
export class DashboardService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async getStats(farmId?: string) {
    const pFilter = farmId ? `WHERE farm_id = $1` : '';
    const fArgs   = farmId ? [farmId] : [];

    const [farms, paddocks, costs, recs, orders, recentTx] = await Promise.all([
      this.db.query('SELECT COUNT(*) FROM farms'),
      this.db.query(`SELECT COUNT(*), COALESCE(SUM(land_area),0) as total_ha FROM paddocks ${pFilter}`, fArgs),
      farmId
        ? this.db.query(
            `SELECT COALESCE(SUM(ft.amount),0) as total
             FROM financial_transactions ft
             JOIN paddocks p ON p.id = ft.paddock_id
             WHERE p.farm_id = $1 AND ft.created_at >= date_trunc('month', CURRENT_DATE)`,
            [farmId],
          )
        : this.db.query(
            `SELECT COALESCE(SUM(amount),0) as total FROM financial_transactions
             WHERE created_at >= date_trunc('month', CURRENT_DATE)`,
          ),
      farmId
        ? this.db.query(
            `SELECT COUNT(*) FROM recommendations r
             JOIN paddocks p ON p.id = r.paddock_id
             WHERE p.farm_id = $1 AND r.status = 'draft'`,
            [farmId],
          )
        : this.db.query(`SELECT COUNT(*) FROM recommendations WHERE status='draft'`),
      farmId
        ? this.db.query(
            `SELECT COUNT(*) FROM supplier_orders so
             JOIN paddocks p ON p.id = so.paddock_id
             WHERE p.farm_id = $1 AND so.status = 'pending'`,
            [farmId],
          )
        : this.db.query(`SELECT COUNT(*) FROM supplier_orders WHERE status='pending'`),
      farmId
        ? this.db.query(
            `SELECT ft.*,
               p.name as paddock_name,
               CASE WHEN ft.source = 'supplier' THEN so.product_name END as product_name,
               CASE WHEN ft.source = 'supplier' THEN sup_user.name END as supplier_name,
               CASE WHEN ft.source = 'labour' THEN COALESCE(labour_user.name, ts.staff_name) END as staff_name,
               CASE WHEN ft.source = 'livestock' THEN m.name END as mob_name
             FROM financial_transactions ft
             JOIN paddocks p ON p.id = ft.paddock_id
             LEFT JOIN supplier_orders so ON so.id = ft.reference_id AND ft.source = 'supplier'
             LEFT JOIN users sup_user ON sup_user.id = so.supplier_id
             LEFT JOIN timesheets ts ON ts.id = ft.reference_id AND ft.source = 'labour'
             LEFT JOIN users labour_user ON labour_user.id = ts.user_id
             LEFT JOIN mob m ON m.id = ft.reference_id AND ft.source = 'livestock'
             WHERE p.farm_id = $1
             ORDER BY ft.created_at DESC LIMIT 10`,
            [farmId],
          )
        : this.db.query(
            `SELECT ft.*,
               p.name as paddock_name,
               CASE WHEN ft.source = 'supplier' THEN so.product_name END as product_name,
               CASE WHEN ft.source = 'supplier' THEN sup_user.name END as supplier_name,
               CASE WHEN ft.source = 'labour' THEN COALESCE(labour_user.name, ts.staff_name) END as staff_name,
               CASE WHEN ft.source = 'livestock' THEN m.name END as mob_name
             FROM financial_transactions ft
             LEFT JOIN paddocks p ON p.id = ft.paddock_id
             LEFT JOIN supplier_orders so ON so.id = ft.reference_id AND ft.source = 'supplier'
             LEFT JOIN users sup_user ON sup_user.id = so.supplier_id
             LEFT JOIN timesheets ts ON ts.id = ft.reference_id AND ft.source = 'labour'
             LEFT JOIN users labour_user ON labour_user.id = ts.user_id
             LEFT JOIN mob m ON m.id = ft.reference_id AND ft.source = 'livestock'
             ORDER BY ft.created_at DESC LIMIT 10`,
          ),
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
        mob_name: r.mob_name ?? null,
      })),
    };
  }

  async getPaddockSummaries(farmId?: string) {
    const filter = farmId ? `WHERE farm_id = $1` : '';
    const args   = farmId ? [farmId] : [];
    const { rows: paddocks } = await this.db.query(
      `SELECT * FROM paddocks ${filter} ORDER BY name`,
      args,
    );

    const summaries = await Promise.all(
      paddocks.map(async (p) => {
        const [labour, fuel, supplier, recs, orders] = await Promise.all([
          this.db.query(`SELECT COALESCE(SUM(total_cost),0) as total FROM timesheets WHERE paddock_id=$1`, [p.id]),
          this.db.query(`SELECT COALESCE(SUM(total_cost),0) as total FROM fuel_logs WHERE paddock_id=$1`, [p.id]),
          this.db.query(`SELECT COALESCE(SUM(total_price),0) as total FROM supplier_orders WHERE paddock_id=$1`, [p.id]),
          this.db.query(`SELECT COUNT(*) FROM recommendations WHERE paddock_id=$1 AND status='draft'`, [p.id]),
          this.db.query(`SELECT COUNT(*) FROM supplier_orders WHERE paddock_id=$1 AND status='pending'`, [p.id]),
        ]);

        const labourCost   = parseFloat(labour.rows[0].total);
        const fuelCost     = parseFloat(fuel.rows[0].total);
        const supplierCost = parseFloat(supplier.rows[0].total);

        // Fetch livestock costs specifically for this paddock
        const { rows: livestock } = await this.db.query(
          `SELECT COALESCE(SUM(amount),0) as total FROM financial_transactions 
           WHERE paddock_id=$1 AND source='livestock'`, 
          [p.id]
        );
        const livestockCost = parseFloat(livestock[0].total);

        return {
          paddock: p,
          total_labour_cost:   labourCost,
          total_fuel_cost:     fuelCost,
          total_supplier_cost: supplierCost,
          total_livestock_cost: livestockCost,
          total_cost:          labourCost + fuelCost + supplierCost + livestockCost,
          open_recommendations: parseInt(recs.rows[0].count),
          pending_orders:       parseInt(orders.rows[0].count),
        };
      }),
    );

    return summaries;
  }

  async getForecasting(farmId?: string) {
    const txJoin   = farmId ? `JOIN paddocks p ON p.id = ft.paddock_id WHERE p.farm_id = $1 AND` : `WHERE`;
    const txArgs   = farmId ? [farmId] : [];
    const pmJoin   = farmId ? `JOIN paddocks p ON p.id = ft.paddock_id WHERE p.farm_id = $1 AND` : `LEFT JOIN paddocks p ON p.id = ft.paddock_id WHERE`;

    const { rows: monthly } = await this.db.query(
      `SELECT
         TO_CHAR(date_trunc('month', ft.created_at), 'YYYY-MM') as month,
         SUM(CASE WHEN ft.source = 'labour'   THEN ft.amount ELSE 0 END) as labour,
         SUM(CASE WHEN ft.source = 'fuel'     THEN ft.amount ELSE 0 END) as fuel,
         SUM(CASE WHEN ft.source = 'supplier' THEN ft.amount ELSE 0 END) as supplier,
         SUM(CASE WHEN ft.source = 'livestock' THEN ft.amount ELSE 0 END) as livestock,
         SUM(ft.amount) as total
       FROM financial_transactions ft
       ${txJoin} ft.created_at >= NOW() - INTERVAL '12 months'
       GROUP BY date_trunc('month', ft.created_at)
       ORDER BY date_trunc('month', ft.created_at) ASC`,
      txArgs,
    );

    const historical = monthly.map(r => ({
      month: r.month,
      labour: parseFloat(r.labour),
      fuel: parseFloat(r.fuel),
      supplier: parseFloat(r.supplier),
      livestock: parseFloat(r.livestock),
      total: parseFloat(r.total),
      projected: false,
    }));

    const last3 = historical.slice(-3);
    const avgLabour   = last3.length ? last3.reduce((s, r) => s + r.labour,   0) / last3.length : 0;
    const avgFuel     = last3.length ? last3.reduce((s, r) => s + r.fuel,     0) / last3.length : 0;
    const avgSupplier = last3.length ? last3.reduce((s, r) => s + r.supplier, 0) / last3.length : 0;
    const avgLivestock = last3.length ? last3.reduce((s, r) => s + r.livestock, 0) / last3.length : 0;

    const projected = [];
    const now = new Date();
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      projected.push({
        month: monthStr,
        labour:   Math.round(avgLabour   * 100) / 100,
        fuel:     Math.round(avgFuel     * 100) / 100,
        supplier: Math.round(avgSupplier * 100) / 100,
        livestock: Math.round(avgLivestock * 100) / 100,
        total:    Math.round((avgLabour + avgFuel + avgSupplier + avgLivestock) * 100) / 100,
        projected: true,
      });
    }

    const { rows: paddockMonthly } = await this.db.query(
      `SELECT
         ft.paddock_id,
         p.name as paddock_name,
         TO_CHAR(date_trunc('month', ft.created_at), 'YYYY-MM') as month,
         SUM(ft.amount) as total
       FROM financial_transactions ft
       ${pmJoin} ft.created_at >= NOW() - INTERVAL '6 months'
       GROUP BY ft.paddock_id, p.name, date_trunc('month', ft.created_at)
       ORDER BY ft.paddock_id, date_trunc('month', ft.created_at)`,
      txArgs,
    );

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

  async getBenchmarking(farmId?: string) {
    const filter = farmId ? `AND p.farm_id = $1` : '';
    const args   = farmId ? [farmId] : [];

    const { rows } = await this.db.query(
      `SELECT
         p.id, p.name, p.land_area, p.crop_type,
         COALESCE(SUM(CASE WHEN ft.source = 'labour'   THEN ft.amount ELSE 0 END), 0) as labour_cost,
         COALESCE(SUM(CASE WHEN ft.source = 'fuel'     THEN ft.amount ELSE 0 END), 0) as fuel_cost,
         COALESCE(SUM(CASE WHEN ft.source = 'supplier' THEN ft.amount ELSE 0 END), 0) as supplier_cost,
         COALESCE(SUM(CASE WHEN ft.source = 'livestock' THEN ft.amount ELSE 0 END), 0) as livestock_cost,
         COALESCE(SUM(ft.amount), 0) as total_cost
       FROM paddocks p
       LEFT JOIN financial_transactions ft ON ft.paddock_id = p.id
       WHERE 1=1 ${filter}
       GROUP BY p.id, p.name, p.land_area, p.crop_type
       ORDER BY total_cost DESC`,
      args,
    );

    const paddocks = rows.map(r => ({
      id: r.id,
      name: r.name,
      land_area: r.land_area ? parseFloat(r.land_area) : null,
      crop_type: r.crop_type,
      labour_cost:   parseFloat(r.labour_cost),
      fuel_cost:     parseFloat(r.fuel_cost),
      supplier_cost: parseFloat(r.supplier_cost),
      livestock_cost: parseFloat(r.livestock_cost),
      total_cost:    parseFloat(r.total_cost),
      cost_per_hectare: r.land_area && parseFloat(r.land_area) > 0
        ? Math.round(parseFloat(r.total_cost) / parseFloat(r.land_area) * 100) / 100
        : null,
    }));

    const withHa = paddocks.filter(p => p.cost_per_hectare !== null)
      .sort((a, b) => a.cost_per_hectare! - b.cost_per_hectare!);

    const result = paddocks.map(p => {
      const rank = withHa.findIndex(x => x.id === p.id);
      const percentile = withHa.length > 1 && rank >= 0
        ? Math.round((1 - rank / (withHa.length - 1)) * 100)
        : null;
      const total = p.total_cost;
      return {
        ...p,
        percentile,
        labour_pct:   total > 0 ? Math.round(p.labour_cost   / total * 100) : 0,
        fuel_pct:     total > 0 ? Math.round(p.fuel_cost     / total * 100) : 0,
        supplier_pct: total > 0 ? Math.round(p.supplier_cost / total * 100) : 0,
        livestock_pct: total > 0 ? Math.round(p.livestock_cost / total * 100) : 0,
      };
    });

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
  getStats(@Query('farm_id') farmId?: string) { return this.service.getStats(farmId); }

  @Get('paddock-summaries')
  getPaddockSummaries(@Query('farm_id') farmId?: string) { return this.service.getPaddockSummaries(farmId); }

  @Get('forecasting')
  getForecasting(@Query('farm_id') farmId?: string) { return this.service.getForecasting(farmId); }

  @Get('benchmarking')
  getBenchmarking(@Query('farm_id') farmId?: string) { return this.service.getBenchmarking(farmId); }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
