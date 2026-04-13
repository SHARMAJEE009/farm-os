import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { IsString, MinLength } from 'class-validator';
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import OpenAI from 'openai';

export class ChatDto {
  @IsString() @MinLength(1) message: string;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';

@Injectable()
export class ChatbotService {
  private openai: OpenAI;

  constructor(@Inject(DATABASE_POOL) private db: Pool) {
    this.openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  }

  async processMessage(message: string): Promise<{ reply: string }> {
    const farmContext = await this.buildFarmContext();

    const systemPrompt = `You are FarmOS AI Assistant — a knowledgeable, friendly assistant for an Australian farm management platform.

You have access to the following live farm data:

${farmContext}

Your capabilities:
- Answer questions about the farm's costs, paddocks, labour, fuel, and supplier orders
- Provide expert guidance on crop management, farming practices, pest control, irrigation, fertilisation, and seasonal operations
- Give advice on Australian agriculture, crop cycles, and agronomy best practices
- Interpret the farm's data and offer actionable insights

Response style:
- Be concise but thorough
- Use **bold** for key figures and headings
- Use bullet points for lists
- Use Australian spelling and a friendly, professional tone
- When citing farm data, be specific with numbers
- For farming practice questions, provide practical, evidence-based advice
- Never make up data — only use the figures provided above`;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ??
      "Sorry, I couldn't generate a response. Please try again.";

    return { reply };
  }

  private async buildFarmContext(): Promise<string> {
    const [paddocks, costs, labour, fuel, orders, recs] = await Promise.all([
      this.db.query(`
        SELECT
          p.name,
          p.crop_type,
          p.land_area,
          p.sowing_date,
          p.latitude,
          p.longitude,
          COALESCE(SUM(ft.amount), 0) AS total_cost
        FROM paddocks p
        LEFT JOIN financial_transactions ft ON ft.paddock_id = p.id
        GROUP BY p.id, p.name, p.crop_type, p.land_area, p.sowing_date, p.latitude, p.longitude
        ORDER BY total_cost DESC
      `),
      this.db.query(`
        SELECT
          source,
          COALESCE(SUM(amount), 0) AS total,
          COUNT(*) AS count
        FROM financial_transactions
        GROUP BY source
      `),
      this.db.query(`
        SELECT
          COALESCE(SUM(hours), 0) AS total_hours,
          COALESCE(SUM(total_cost), 0) AS total_cost,
          COUNT(DISTINCT COALESCE(user_id::text, staff_name)) AS staff_count
        FROM timesheets
      `),
      this.db.query(`
        SELECT
          COALESCE(SUM(litres), 0) AS total_litres,
          COALESCE(SUM(total_cost), 0) AS total_cost,
          COALESCE(AVG(price_per_litre), 0) AS avg_price
        FROM fuel_logs
      `),
      this.db.query(`
        SELECT status, COUNT(*) AS count, COALESCE(SUM(total_price), 0) AS value
        FROM supplier_orders
        GROUP BY status
      `),
      this.db.query(`
        SELECT
          r.type,
          r.status,
          r.description,
          p.name AS paddock_name
        FROM recommendations r
        LEFT JOIN paddocks p ON p.id = r.paddock_id
        ORDER BY r.created_at DESC
        LIMIT 10
      `),
    ]);

    // Paddocks section
    const paddockLines = paddocks.rows.map((p: any) => {
      const ha = p.land_area ? `${parseFloat(p.land_area).toFixed(1)} ha` : 'area unknown';
      const crop = p.crop_type || 'no crop set';
      const sowing = p.sowing_date ? `, sown ${p.sowing_date.toString().slice(0, 10)}` : '';
      const cost = parseFloat(p.total_cost);
      const coords =
        p.latitude && p.longitude
          ? `, coords (${parseFloat(p.latitude).toFixed(4)}, ${parseFloat(p.longitude).toFixed(4)})`
          : '';
      return `  - ${p.name}: ${ha}, crop: ${crop}${sowing}, total spend: $${cost.toFixed(2)}${coords}`;
    });

    // Costs by source
    const costMap: Record<string, number> = {};
    let grandTotal = 0;
    costs.rows.forEach((r: any) => {
      costMap[r.source] = parseFloat(r.total);
      grandTotal += parseFloat(r.total);
    });

    // Labour
    const lab = labour.rows[0];
    const labHours = parseFloat(lab.total_hours).toFixed(1);
    const labCost = parseFloat(lab.total_cost).toFixed(2);

    // Fuel
    const f = fuel.rows[0];
    const fuelLitres = parseFloat(f.total_litres).toFixed(0);
    const fuelCost = parseFloat(f.total_cost).toFixed(2);
    const fuelAvg = parseFloat(f.avg_price).toFixed(3);

    // Orders
    const ordMap: Record<string, { count: number; value: number }> = {};
    orders.rows.forEach((r: any) => {
      ordMap[r.status] = { count: parseInt(r.count), value: parseFloat(r.value) };
    });

    // Recommendations
    const recLines = recs.rows.map((r: any) => `  - [${r.status}] ${r.type} — ${r.paddock_name || 'unknown paddock'}${r.description ? ': ' + r.description : ''}`);

    return `
=== PADDOCKS (${paddocks.rows.length} total) ===
${paddockLines.join('\n') || '  None'}

=== FINANCIAL OVERVIEW ===
Grand total spend: $${grandTotal.toFixed(2)}
  Labour:   $${(costMap['labour'] ?? 0).toFixed(2)}
  Fuel:     $${(costMap['fuel'] ?? 0).toFixed(2)}
  Supplier: $${(costMap['supplier'] ?? 0).toFixed(2)}

=== LABOUR ===
Total hours: ${labHours} hrs
Total labour cost: $${labCost}
Staff members: ${lab.staff_count}

=== FUEL ===
Total litres: ${fuelLitres} L
Total fuel cost: $${fuelCost}
Average price per litre: $${fuelAvg}

=== SUPPLIER ORDERS ===
Pending:   ${ordMap['pending']?.count ?? 0} orders ($${(ordMap['pending']?.value ?? 0).toFixed(2)})
Ordered:   ${ordMap['ordered']?.count ?? 0} orders ($${(ordMap['ordered']?.value ?? 0).toFixed(2)})
Delivered: ${ordMap['delivered']?.count ?? 0} orders ($${(ordMap['delivered']?.value ?? 0).toFixed(2)})

=== RECENT RECOMMENDATIONS ===
${recLines.join('\n') || '  None'}
`.trim();
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
