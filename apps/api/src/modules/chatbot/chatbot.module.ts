import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsString, MinLength } from 'class-validator';
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';

export class ChatDto {
  @IsString() @MinLength(1) message: string;
}

function fmt(n: number) {
  return `$${n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

@Injectable()
export class ChatbotService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async processMessage(message: string): Promise<{ reply: string; data?: any }> {
    const msg = message.toLowerCase().trim();

    // Greetings
    if (/^(hi|hello|hey|howdy|g'day|gday)/.test(msg)) {
      return {
        reply: "G'day! I'm your Farm OS assistant. I can help you with costs, paddocks, staff hours, fuel usage, supplier orders, and recommendations.\n\nWhat would you like to know?",
      };
    }

    // Help
    if (/\b(help|what can you|capabilities|what do you know)\b/.test(msg)) {
      return {
        reply: "I can answer questions like:\n• \"What are my total costs?\"\n• \"Show me paddock details\"\n• \"How many hours have staff worked?\"\n• \"What's my fuel spend?\"\n• \"Any pending recommendations?\"\n• \"Summary of supplier orders\"\n• \"Which paddock costs the most?\"\n\nJust ask away!",
      };
    }

    // Overview / Summary
    if (/\b(overview|summary|dashboard|farm status|how is the farm)\b/.test(msg)) {
      return this.getFarmSummary();
    }

    // Labour / Staff / Hours
    if (/\b(labour|labor|staff|hours|timesheet|worker)\b/.test(msg)) {
      return this.getLabourSummary();
    }

    // Fuel
    if (/\b(fuel|diesel|petrol|litre|liter)\b/.test(msg)) {
      return this.getFuelSummary();
    }

    // Supplier / Orders
    if (/\b(supplier|order|orders|product|delivery|delivered)\b/.test(msg)) {
      return this.getSupplierSummary();
    }

    // Recommendations / Agronomy
    if (/\b(recommendation|agronomy|agronomist|advice|spray|fertiliser)\b/.test(msg)) {
      return this.getRecommendationsSummary();
    }

    // Paddock specific
    if (/\b(paddock|field|plot|block|area|land|hectare)\b/.test(msg)) {
      return this.getPaddockSummary();
    }

    // Total cost / spending
    if (/\b(cost|costs|spend|spending|budget|money|financial|finance|total)\b/.test(msg)) {
      return this.getCostSummary();
    }

    // Weather
    if (/\b(weather|rain|rainfall|temperature|forecast)\b/.test(msg)) {
      return {
        reply: "For weather forecasts and rainfall data, I recommend checking the Bureau of Meteorology at bom.gov.au. They have detailed agricultural weather forecasts for all Australian regions.",
      };
    }

    // Default: general farm summary
    return this.getFarmSummary();
  }

  private async getFarmSummary() {
    const [costs, paddocks, recs, orders, labourHours] = await Promise.all([
      this.db.query(`SELECT COALESCE(SUM(amount),0) as total, COALESCE(SUM(CASE WHEN created_at >= date_trunc('month',CURRENT_DATE) THEN amount END),0) as month_total FROM financial_transactions`),
      this.db.query(`SELECT COUNT(*) as count, COALESCE(SUM(area_hectares),0) as ha FROM paddocks`),
      this.db.query(`SELECT COUNT(*) as pending FROM recommendations WHERE status='draft'`),
      this.db.query(`SELECT COUNT(*) as pending FROM supplier_orders WHERE status='pending'`),
      this.db.query(`SELECT COALESCE(SUM(hours),0) as total FROM timesheets`),
    ]);

    const total = parseFloat(costs.rows[0].total);
    const monthTotal = parseFloat(costs.rows[0].month_total);
    const paddockCount = parseInt(paddocks.rows[0].count);
    const totalHa = parseFloat(paddocks.rows[0].ha);
    const pendingRecs = parseInt(recs.rows[0].pending);
    const pendingOrders = parseInt(orders.rows[0].pending);
    const totalHours = parseFloat(labourHours.rows[0].total);

    return {
      reply: `Here's your farm overview:\n\n📊 **Total Costs:** ${fmt(total)}\n📅 **This Month:** ${fmt(monthTotal)}\n🌾 **Paddocks:** ${paddockCount} (${totalHa.toFixed(1)} ha total)\n⏱ **Staff Hours Logged:** ${totalHours.toFixed(1)} hrs\n📋 **Pending Recommendations:** ${pendingRecs}\n🛒 **Pending Orders:** ${pendingOrders}`,
      data: { total, month_total: monthTotal, paddocks: paddockCount, total_ha: totalHa },
    };
  }

  private async getCostSummary() {
    const { rows } = await this.db.query(`
      SELECT
        source,
        COALESCE(SUM(amount),0) as total,
        COUNT(*) as count
      FROM financial_transactions
      GROUP BY source
    `);

    const bySource: Record<string, number> = {};
    let grandTotal = 0;
    rows.forEach(r => {
      bySource[r.source] = parseFloat(r.total);
      grandTotal += parseFloat(r.total);
    });

    const labour   = bySource['labour']   ?? 0;
    const fuel     = bySource['fuel']     ?? 0;
    const supplier = bySource['supplier'] ?? 0;

    return {
      reply: `Here's your cost breakdown:\n\n💰 **Total:** ${fmt(grandTotal)}\n👷 **Labour:** ${fmt(labour)} (${grandTotal > 0 ? Math.round(labour/grandTotal*100) : 0}%)\n⛽ **Fuel:** ${fmt(fuel)} (${grandTotal > 0 ? Math.round(fuel/grandTotal*100) : 0}%)\n📦 **Supplier:** ${fmt(supplier)} (${grandTotal > 0 ? Math.round(supplier/grandTotal*100) : 0}%)`,
      data: { total: grandTotal, labour, fuel, supplier },
    };
  }

  private async getLabourSummary() {
    const { rows } = await this.db.query(`
      SELECT
        COALESCE(SUM(t.hours),0) as total_hours,
        COALESCE(SUM(t.total_cost),0) as total_cost,
        COUNT(DISTINCT t.user_id) as staff_count,
        COUNT(*) as entry_count
      FROM timesheets t
    `);
    const r = rows[0];
    const hours = parseFloat(r.total_hours);
    const cost  = parseFloat(r.total_cost);
    const avgRate = hours > 0 ? cost / hours : 0;

    const { rows: topStaff } = await this.db.query(`
      SELECT u.name, SUM(t.hours) as hours, SUM(t.total_cost) as cost
      FROM timesheets t LEFT JOIN users u ON u.id = t.user_id
      GROUP BY u.name ORDER BY hours DESC LIMIT 3
    `);

    const topList = topStaff.map(s => `  • ${s.name}: ${parseFloat(s.hours).toFixed(1)} hrs (${fmt(parseFloat(s.cost))})`).join('\n');

    return {
      reply: `Labour Summary:\n\n⏱ **Total Hours:** ${hours.toFixed(1)} hrs\n💰 **Total Labour Cost:** ${fmt(cost)}\n📊 **Avg Rate:** ${fmt(avgRate)}/hr\n👷 **Staff Members:** ${parseInt(r.staff_count)}\n\nTop workers:\n${topList || '  No data yet'}`,
      data: { total_hours: hours, total_cost: cost, staff_count: parseInt(r.staff_count) },
    };
  }

  private async getFuelSummary() {
    const { rows } = await this.db.query(`
      SELECT
        COALESCE(SUM(fl.litres),0) as total_litres,
        COALESCE(SUM(fl.total_cost),0) as total_cost,
        COALESCE(AVG(fl.price_per_litre),0) as avg_price
      FROM fuel_logs fl
    `);
    const r = rows[0];
    const litres = parseFloat(r.total_litres);
    const cost   = parseFloat(r.total_cost);
    const avgPrice = parseFloat(r.avg_price);

    const { rows: byPaddock } = await this.db.query(`
      SELECT p.name, SUM(fl.litres) as litres, SUM(fl.total_cost) as cost
      FROM fuel_logs fl LEFT JOIN paddocks p ON p.id = fl.paddock_id
      GROUP BY p.name ORDER BY litres DESC LIMIT 3
    `);

    const paddockList = byPaddock.map(p => `  • ${p.name}: ${parseFloat(p.litres).toFixed(0)}L (${fmt(parseFloat(p.cost))})`).join('\n');

    return {
      reply: `Fuel Summary:\n\n⛽ **Total Litres:** ${litres.toFixed(0)}L\n💰 **Total Cost:** ${fmt(cost)}\n📊 **Avg Price/L:** ${fmt(avgPrice)}\n\nTop paddocks by usage:\n${paddockList || '  No data yet'}`,
      data: { total_litres: litres, total_cost: cost, avg_price: avgPrice },
    };
  }

  private async getSupplierSummary() {
    const { rows } = await this.db.query(`
      SELECT
        status,
        COUNT(*) as count,
        COALESCE(SUM(total_price),0) as total_value
      FROM supplier_orders
      GROUP BY status
    `);

    const byStatus: Record<string, any> = {};
    rows.forEach(r => { byStatus[r.status] = { count: parseInt(r.count), value: parseFloat(r.total_value) }; });

    const { rows: topProducts } = await this.db.query(`
      SELECT product_name, COUNT(*) as orders, SUM(total_price) as total
      FROM supplier_orders
      GROUP BY product_name ORDER BY total DESC LIMIT 3
    `);

    const productList = topProducts.map(p => `  • ${p.product_name}: ${p.orders} order(s) — ${fmt(parseFloat(p.total))}`).join('\n');
    const pending   = byStatus['pending']   ?? { count: 0, value: 0 };
    const ordered   = byStatus['ordered']   ?? { count: 0, value: 0 };
    const delivered = byStatus['delivered'] ?? { count: 0, value: 0 };

    return {
      reply: `Supplier Orders Summary:\n\n⏳ **Pending:** ${pending.count} orders (${fmt(pending.value)})\n📦 **Ordered:** ${ordered.count} orders (${fmt(ordered.value)})\n✅ **Delivered:** ${delivered.count} orders (${fmt(delivered.value)})\n\nTop products by spend:\n${productList || '  No orders yet'}`,
      data: { pending, ordered, delivered },
    };
  }

  private async getPaddockSummary() {
    const { rows } = await this.db.query(`
      SELECT
        p.name, p.area_hectares, p.crop_type,
        COALESCE(SUM(ft.amount),0) as total_cost
      FROM paddocks p
      LEFT JOIN financial_transactions ft ON ft.paddock_id = p.id
      GROUP BY p.id, p.name, p.area_hectares, p.crop_type
      ORDER BY total_cost DESC
    `);

    const paddockList = rows.map(p => {
      const cost = parseFloat(p.total_cost);
      const ha = p.area_hectares ? parseFloat(p.area_hectares) : null;
      const cph = ha && ha > 0 ? ` (${fmt(cost / ha)}/ha)` : '';
      return `  • ${p.name}${ha ? ` — ${ha}ha` : ''}${p.crop_type ? `, ${p.crop_type}` : ''}: ${fmt(cost)}${cph}`;
    }).join('\n');

    return {
      reply: `Paddock Summary (${rows.length} paddocks):\n\n${paddockList || 'No paddocks found'}`,
      data: rows,
    };
  }

  private async getRecommendationsSummary() {
    const { rows } = await this.db.query(`
      SELECT status, COUNT(*) as count FROM recommendations GROUP BY status
    `);

    const byStatus: Record<string, number> = {};
    rows.forEach(r => { byStatus[r.status] = parseInt(r.count); });

    const { rows: recent } = await this.db.query(`
      SELECT r.type, r.status, p.name as paddock_name
      FROM recommendations r LEFT JOIN paddocks p ON p.id = r.paddock_id
      ORDER BY r.created_at DESC LIMIT 5
    `);

    const recentList = recent.map(r => `  • ${r.type} — ${r.paddock_name} [${r.status}]`).join('\n');

    return {
      reply: `Agronomy Recommendations:\n\n📋 **Draft:** ${byStatus['draft'] ?? 0}\n✅ **Approved:** ${byStatus['approved'] ?? 0}\n❌ **Rejected:** ${byStatus['rejected'] ?? 0}\n\nRecent recommendations:\n${recentList || '  None yet'}`,
      data: byStatus,
    };
  }
}

@ApiTags('chatbot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly service: ChatbotService) {}

  @Post()
  chat(@Body() dto: ChatDto) {
    return this.service.processMessage(dto.message);
  }
}

@Module({ controllers: [ChatbotController], providers: [ChatbotService] })
export class ChatbotModule {}
