const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const db = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_I92RbErqHPAo@ep-quiet-sun-a1lotmv6-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

async function runMigration() {
  console.log('🌱 Starting migration: Drop soil_reports...');
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migrations/008_drop_soil_reports.sql'), 'utf-8');
    await db.query(sql);
    console.log('✅ Migration 008 complete. Table dropped.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await db.end();
  }
}

runMigration();
