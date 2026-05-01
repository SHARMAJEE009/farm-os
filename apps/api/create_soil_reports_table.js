require('dotenv').config({ path: './.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS soil_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paddock_id UUID NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
        farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
        uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
        file_path VARCHAR(500) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        season VARCHAR(100),
        status VARCHAR(50) DEFAULT 'uploaded' CHECK (status IN ('uploaded','processing','ai_processed','failed')),
        ai_recommendation JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_soil_reports_paddock ON soil_reports(paddock_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_soil_reports_farm ON soil_reports(farm_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_soil_reports_uploaded_by ON soil_reports(uploaded_by);`);

    console.log('✅ soil_reports table created successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
