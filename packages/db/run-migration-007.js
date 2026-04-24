const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const db = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_I92RbErqHPAo@ep-quiet-sun-a1lotmv6-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '007_create_soil_reports.sql'), 'utf8');
  console.log('Running migration 007 – create soil_reports table…');
  await db.query(sql);
  console.log('✅ Migration 007 complete.');
  await db.end();
}

run().catch(e => { console.error('❌ Migration failed:', e.message); process.exit(1); });
