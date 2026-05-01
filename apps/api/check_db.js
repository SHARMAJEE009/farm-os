const { Pool } = require('pg');
require('dotenv').config({ path: './.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables found:', res.rows.map(r => r.table_name));
    
    // Check if tasks table has all columns
    const tasksCols = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tasks'
    `);
    console.log('Tasks columns:', tasksCols.rows.map(r => r.column_name));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
