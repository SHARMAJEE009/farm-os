import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private openai: OpenAI;

  constructor(@Inject(DATABASE_POOL) private db: Pool) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });
  }

  async chat(message: string, farmId: string) {
    try {
      const context = await this.getFarmContext(farmId);
      
      const systemPrompt = `You are a helpful AI Farming Assistant for FarmOS. 
Below is the current data for the farm "${context.farmName}":

- Total Paddocks: ${context.totalPaddocks}
- Financials (This Month):
  - Labour: $${context.costs.labour.toFixed(2)}
  - Fuel: $${context.costs.fuel.toFixed(2)}
  - Supplier: $${context.costs.supplier.toFixed(2)}
  - Livestock: $${context.costs.livestock.toFixed(2)}
  - Total: $${context.costs.total.toFixed(2)}
- Intelligence:
  - Open Recommendations: ${context.openRecommendations}
  - Pending Orders: ${context.pendingOrders}
- Livestock:
  - Active Mobs: ${context.activeMobs}
  - Total Head on Farm: ${context.totalHead}
  - Active Health Alerts (WHP Expiries): ${context.healthAlerts.length}
    ${context.healthAlerts.map(a => `- ${a.mob_name}: ${a.event_type} (Exp: ${new Date(a.whp_expiry_date).toLocaleDateString()})`).join('\n    ')}

Answer the user's questions in plain English based on this data. Be concise, professional, and helpful. 
If asked about costs, refer to the "This Month" figures unless otherwise specified.
If asked about health alerts, list them if they exist.
Use Australian English spelling.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        max_tokens: 1024,
      });

      return { response: response.choices[0].message.content || 'No response generated' };
    } catch (error) {
      console.error('AI Chat Error:', error);
      throw error;
    }
  }

  private async getFarmContext(farmId: string) {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [farm, paddocks, costs, recs, orders, mobs, alerts] = await Promise.all([
        this.db.query('SELECT name FROM farms WHERE id = $1', [farmId]),
        this.db.query('SELECT COUNT(*) FROM paddocks WHERE farm_id = $1', [farmId]),
        this.db.query(`
          SELECT ft.source, SUM(ft.amount) as total 
          FROM financial_transactions ft
          LEFT JOIN paddocks p ON p.id = ft.paddock_id
          LEFT JOIN mob m ON m.id = ft.reference_id AND ft.source = 'livestock'
          WHERE (p.farm_id = $1 OR m.farm_id = $1)
          AND ft.created_at >= $2
          GROUP BY ft.source
        `, [farmId, firstDayOfMonth]),
        this.db.query(`
          SELECT COUNT(*) FROM recommendations r
          JOIN paddocks p ON p.id = r.paddock_id
          WHERE p.farm_id = $1 AND r.status = 'draft'
        `, [farmId]),
        this.db.query(`
          SELECT COUNT(*) FROM supplier_orders so
          JOIN paddocks p ON p.id = so.paddock_id
          WHERE p.farm_id = $1 AND so.status = 'pending'
        `, [farmId]),
        this.db.query(`
          SELECT COUNT(*) as mob_count, SUM(head_count) as total_head
          FROM mob
          WHERE farm_id = $1 AND status = 'active'
        `, [farmId]),
        this.db.query(`
          SELECT m.name as mob_name, h.event_type, h.whp_expiry_date
          FROM health_event h
          JOIN mob m ON h.mob_id = m.id
          WHERE m.farm_id = $1 AND h.whp_expiry_date > CURRENT_DATE
        `, [farmId])
      ]);

      const costBreakdown = {
        labour: 0,
        fuel: 0,
        supplier: 0,
        livestock: 0,
        total: 0
      };

      costs.rows.forEach(r => {
        const source = r.source as keyof typeof costBreakdown;
        const amount = parseFloat(r.total || '0');
        if (costBreakdown.hasOwnProperty(source)) {
          costBreakdown[source] = amount;
        }
        costBreakdown.total += amount;
      });

      return {
        farmName: farm.rows[0]?.name || 'Unknown Farm',
        totalPaddocks: parseInt(paddocks.rows[0]?.count || '0'),
        costs: costBreakdown,
        openRecommendations: parseInt(recs.rows[0]?.count || '0'),
        pendingOrders: parseInt(orders.rows[0]?.count || '0'),
        activeMobs: parseInt(mobs.rows[0]?.mob_count || '0'),
        totalHead: parseInt(mobs.rows[0]?.total_head || '0'),
        healthAlerts: alerts.rows || []
      };
    } catch (error) {
      console.error('getFarmContext Error:', error);
      throw error;
    }
  }
}
