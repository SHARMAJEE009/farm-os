/**
 * Run migration 006: adds description, state, postcode, total_area_hectares to farms
 * Usage: node run-migration-006.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const db = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_I92RbErqHPAo@ep-quiet-sun-a1lotmv6-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '006_farms_extra_fields.sql'), 'utf8');
  console.log('Running migration 006...');
  await db.query(sql);
  console.log('✅ Migration 006 complete.');
  await db.end();
}

run().catch(e => { console.error('❌ Migration failed:', e.message); process.exit(1); });
