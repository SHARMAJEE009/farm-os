import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';

export interface ParsedSoilReport {
  file_name?: string;
  lab_name?: string;
  adviser_name?: string;
  sample_date?: string;
  crop?: string;
  target_yield_t_ha?: number;
  area_ha?: number;
  soil_texture?: string;
  soil_type?: string;
  ph_topsoil?: number;
  ph_topsoil_status?: string;
  ph_subsoil?: number;
  ph_subsoil_status?: string;
  organic_carbon?: number;
  organic_carbon_status?: string;
  ec_topsoil?: number;
  nitrate_n?: number;
  nitrate_n_status?: string;
  phosphorus?: number;
  phosphorus_status?: string;
  potassium?: number;
  potassium_status?: string;
  sulfate_s?: number;
  sulfate_s_status?: string;
  calcium?: number;
  calcium_status?: string;
  magnesium?: number;
  magnesium_status?: string;
  zinc?: number;
  zinc_status?: string;
  copper?: number;
  copper_status?: string;
  manganese?: number;
  boron?: number;
  recommended_n_rate?: number;
  n_rate_kg_ha?: number;
  p_rate_kg_ha?: number;
  s_rate_kg_ha?: number;
  zn_rate_kg_ha?: number;
  recommendations?: Array<{
    timing: string;
    product: string;
    application: string;
    rate: string;
    quantity: string;
  }>;
}

function n(text: string, re: RegExp): number | undefined {
  const m = text.match(re);
  if (!m) return undefined;
  const v = parseFloat(m[1]);
  return isNaN(v) ? undefined : v;
}

export function parseSoilText(text: string): ParsedSoilReport {
  const r: ParsedSoilReport = {};

  // Lab & adviser
  const lab = text.match(/LABORATORY[:\s]+([^\n\r]+)/i);
  if (lab) r.lab_name = lab[1].trim();

  const adv = text.match(/(?:ACCREDITED ADVISER|Prepared By\s*:?)\s+([^\n\r]+)/i);
  if (adv) r.adviser_name = adv[1].trim();

  // Sample date
  const sd = text.match(/Date of sampling[:\s]+([^\n\r]+)/i) ?? text.match(/Sample Date[:\s]+([^\n\r]+)/i);
  if (sd) r.sample_date = sd[1].trim();

  // Paddock area (ha) — "AREA (ha): 107" or "Area (ha) 107"
  const areaMatch = text.match(/AREA\s*\(ha\)[:\s]+([\d.]+)/i) ?? text.match(/Area\s*\(ha\)\s+([\d.]+)/i);
  if (areaMatch) r.area_ha = parseFloat(areaMatch[1]);

  // Crop name
  const cropLine = text.match(/Crop[:\s]+([^\n\r]+)/i);
  if (cropLine) {
    r.crop = cropLine[1].split(/\s*[-–]\s/)[0].trim();
  } else {
    const evalLine = text.match(/Evaluation table\s+([^\n\r]+)/i);
    if (evalLine) r.crop = evalLine[1].trim().split(/\s+/).slice(0, 2).join(' ');
  }

  // Target yield
  const ty = text.match(/Target production[^\d]*([\d.]+)/i);
  if (ty) r.target_yield_t_ha = parseFloat(ty[1]);

  // Soil texture / type
  const tex = text.match(/Soil texture\s+([^\n\r]+)/i);
  if (tex) r.soil_texture = tex[1].trim();
  const st = text.match(/Soil Type[:\s]+([^\n\r]+)/i);
  if (st) r.soil_type = st[1].trim();

  // pH topsoil  "pH (1:5 H2O) 7.1 - Satisfactory 8.6 - High"
  const phLine = text.match(/pH\s*\(1:5\s*H2O\)\s+([\d.]+)\s*[-–]\s*(\w+)/i);
  if (phLine) { r.ph_topsoil = parseFloat(phLine[1]); r.ph_topsoil_status = phLine[2]; }

  // pH subsoil — second occurrence after first match
  const phAll = [...text.matchAll(/pH\s*\(1:5\s*H2O\)[\s\S]*?([\d.]+)\s*[-–]\s*(\w+)/gi)];
  if (phAll.length >= 2) { r.ph_subsoil = parseFloat(phAll[1][1]); r.ph_subsoil_status = phAll[1][2]; }

  // Organic carbon
  const oc = text.match(/Organic carbon[^%\n]*%?\s*([\d.]+)\s*[-–]\s*(\w+)/i);
  if (oc) { r.organic_carbon = parseFloat(oc[1]); r.organic_carbon_status = oc[2]; }

  // EC topsoil
  const ec = text.match(/EC\s*\(1:5\s*H2O\)[^\n]*?\s+([\d.]+)\s*[-–]\s*\w+/i);
  if (ec) r.ec_topsoil = parseFloat(ec[1]);

  // Nitrate-N
  const nn = text.match(/Nitrate-N[^\n]*([\d.]+)\s*[-–]\s*(\w+)/i);
  if (nn) { r.nitrate_n = parseFloat(nn[1]); r.nitrate_n_status = nn[2]; }

  // Phosphorus (Colwell)
  const ph = text.match(/Phosphorus\s*\(Colwell\)[^\n]*([\d.]+)\s*[-–]\s*(\w+)/i);
  if (ph) { r.phosphorus = parseFloat(ph[1]); r.phosphorus_status = ph[2]; }

  // Potassium
  const pk = text.match(/Potassium\s*\(Amm-Acet\.\)[^\n]*([\d.]+)\s*[-–]\s*(\w+)/i);
  if (pk) { r.potassium = parseFloat(pk[1]); r.potassium_status = pk[2]; }

  // Sulfate-S
  const ps = text.match(/Sulfate-S[^\n]*([\d.]+)\s*[-–]\s*(\w+)/i);
  if (ps) { r.sulfate_s = parseFloat(ps[1]); r.sulfate_s_status = ps[2]; }

  // Calcium
  const ca = text.match(/Calcium\s*\(Amm-Acet\)[^\n]*([\d.]+)\s*[-–]\s*(\w+)/i);
  if (ca) { r.calcium = parseFloat(ca[1]); r.calcium_status = ca[2]; }

  // Magnesium
  const mg = text.match(/Magnesium\s*\(Amm-Acet\.\)[^\n]*([\d.]+)\s*[-–]\s*(\w+)/i);
  if (mg) { r.magnesium = parseFloat(mg[1]); r.magnesium_status = mg[2]; }

  // Zinc
  const zn = text.match(/Zinc\s*\(DTPA\)[^\n]*([\d.]+)\s*[-–]\s*(\w+)/i);
  if (zn) { r.zinc = parseFloat(zn[1]); r.zinc_status = zn[2]; }

  // Copper
  const cu = text.match(/Copper\s*\(DTPA\)[^\n]*([\d.]+)\s*[-–]\s*\w+/i);
  if (cu) r.copper = parseFloat(cu[1]);

  // Manganese
  const mn = text.match(/Manganese\s*\(DTPA\)[^\n]*([\d.]+)\s*[-–]\s*\w+/i);
  if (mn) r.manganese = parseFloat(mn[1]);

  // Boron
  const bo = text.match(/Boron[^\n]*([\d.]+)\s*[-–]\s*\w+/i);
  if (bo) r.boron = parseFloat(bo[1]);

  // Nutrient requirements — "NITROGEN (kg/ha) 19.0 (122.7)"  brackets = total req
  const nrq = text.match(/NITROGEN\s*\(kg\/ha\)\s*([\d.]+)\s*\(([\d.]+)\)/i);
  if (nrq) { r.recommended_n_rate = parseFloat(nrq[1]); r.n_rate_kg_ha = parseFloat(nrq[2]); }
  else { const nrq2 = text.match(/NITROGEN\s*\(kg\/ha\)\s*([\d.]+)/i); if (nrq2) r.n_rate_kg_ha = parseFloat(nrq2[1]); }

  const prq = text.match(/PHOSPHORUS\s*\(kg\/ha\)\s*([\d.]+)\s*\(([\d.]+)\)/i);
  if (prq) r.p_rate_kg_ha = parseFloat(prq[2]);
  else { const prq2 = text.match(/PHOSPHORUS\s*\(kg\/ha\)\s*([\d.]+)/i); if (prq2) r.p_rate_kg_ha = parseFloat(prq2[1]); }

  const srq = text.match(/SULFUR\s*\(kg\/ha\)\s*\(([\d.]+)\)/i) ?? text.match(/SULFUR\s*\(kg\/ha\)\s*([\d.]+)/i);
  if (srq) r.s_rate_kg_ha = parseFloat(srq[1]);

  const zrq = text.match(/ZINC\s*\(kg\/ha\)\s*([\d.]+)\s*\(([\d.]+)\)/i);
  if (zrq) r.zn_rate_kg_ha = parseFloat(zrq[2]);
  else { const zrq2 = text.match(/ZINC\s*\(kg\/ha\)\s*([\d.]+)/i); if (zrq2) r.zn_rate_kg_ha = parseFloat(zrq2[1]); }

  // Product recommendations — rows with kg/ha or 't' quantity
  const recIdx = text.search(/RECOMMENDATION[:\s]*\w/i);
  if (recIdx >= 0) {
    const section = text.slice(recIdx, recIdx + 1200);
    const recs: NonNullable<ParsedSoilReport['recommendations']> = [];
    for (const line of section.split(/[\n\r]+/)) {
      if (line.match(/^RECOMMENDATION|NUTRIENT RATES|NITROGEN|PHOSPHORUS|SULFUR|ZINC|Paddock/i)) continue;
      const parts = line.split(/\t|\s{2,}/).map(p => p.trim()).filter(Boolean);
      if (parts.length >= 3 && parts.some(p => /kg\/ha|^\d+\.?\d*t$/.test(p))) {
        recs.push({ timing: parts[0], product: parts[1] ?? '', application: parts[2] ?? '', rate: parts[3] ?? '', quantity: parts[4] ?? '' });
      }
    }
    if (recs.length) r.recommendations = recs;
  }

  return r;
}

@Injectable()
export class SoilReportsService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  async parsePdf(buffer: Buffer, originalName: string): Promise<ParsedSoilReport> {
    let text = '';
    try {
      // Use the inner lib directly to avoid pdf-parse@1.1.1 test-file side-effect on require()
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require('pdf-parse/lib/pdf-parse.js');
      console.log('[SoilReports] pdf-parse type:', typeof pdfParse);
      if (typeof pdfParse !== 'function') {
        throw new Error(`pdf-parse is not a function (got ${typeof pdfParse}). Re-install pdf-parse@1.1.1.`);
      }
      const data = await pdfParse(buffer);
      text = data.text ?? '';
      console.log('[SoilReports] parsed text length:', text.length);
    } catch (err: any) {
      console.error('[SoilReports] PDF parse error:', err?.message ?? err);
      throw new Error(`PDF parsing failed: ${err?.message ?? 'unknown error'}`);
    }
    const parsed = parseSoilText(text);
    return { ...parsed, file_name: originalName };
  }

  async create(
    paddock_id: string,
    farm_id: string | undefined,
    data: ParsedSoilReport,
  ) {
    const { rows } = await this.db.query(
      `INSERT INTO soil_reports (
        paddock_id, farm_id, file_name,
        lab_name, adviser_name, sample_date,
        crop, target_yield_t_ha, soil_texture, soil_type,
        ph_topsoil, ph_topsoil_status, ph_subsoil, ph_subsoil_status,
        organic_carbon, organic_carbon_status, ec_topsoil,
        nitrate_n, nitrate_n_status,
        phosphorus, phosphorus_status,
        potassium, potassium_status,
        sulfate_s, sulfate_s_status,
        calcium, calcium_status,
        magnesium, magnesium_status,
        zinc, zinc_status,
        copper, copper_status,
        manganese, boron,
        recommended_n_rate, n_rate_kg_ha, p_rate_kg_ha, s_rate_kg_ha, zn_rate_kg_ha,
        recommendations
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,
        $31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
        $41
      ) RETURNING *`,
      [
        paddock_id, farm_id ?? null, data.file_name ?? null,
        data.lab_name ?? null, data.adviser_name ?? null, data.sample_date ?? null,
        data.crop ?? null, data.target_yield_t_ha ?? null, data.soil_texture ?? null, data.soil_type ?? null,
        data.ph_topsoil ?? null, data.ph_topsoil_status ?? null,
        data.ph_subsoil ?? null, data.ph_subsoil_status ?? null,
        data.organic_carbon ?? null, data.organic_carbon_status ?? null, data.ec_topsoil ?? null,
        data.nitrate_n ?? null, data.nitrate_n_status ?? null,
        data.phosphorus ?? null, data.phosphorus_status ?? null,
        data.potassium ?? null, data.potassium_status ?? null,
        data.sulfate_s ?? null, data.sulfate_s_status ?? null,
        data.calcium ?? null, data.calcium_status ?? null,
        data.magnesium ?? null, data.magnesium_status ?? null,
        data.zinc ?? null, data.zinc_status ?? null,
        data.copper ?? null, data.copper_status ?? null,
        data.manganese ?? null, data.boron ?? null,
        data.recommended_n_rate ?? null, data.n_rate_kg_ha ?? null,
        data.p_rate_kg_ha ?? null, data.s_rate_kg_ha ?? null, data.zn_rate_kg_ha ?? null,
        data.recommendations ? JSON.stringify(data.recommendations) : null,
      ],
    );
    return rows[0];
  }

  async findByPaddock(paddock_id: string) {
    const { rows } = await this.db.query(
      'SELECT * FROM soil_reports WHERE paddock_id = $1 ORDER BY created_at DESC',
      [paddock_id],
    );
    return rows;
  }

  async remove(id: string) {
    await this.db.query('DELETE FROM soil_reports WHERE id = $1', [id]);
    return { deleted: true };
  }
}
