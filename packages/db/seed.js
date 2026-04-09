/**
 * FARM OS — Demo Seed Script
 * Run: node seed.js
 * Requires: DATABASE_URL env var set
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const db = new Pool({
  connectionString: process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_I92RbErqHPAo@ep-quiet-sun-a1lotmv6-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  console.log('🌱 Starting seed...');

  // 1. Farm
  const { rows: [farm] } = await db.query(`
    INSERT INTO farms (name, location, country)
    VALUES ('Riverdale Station', 'Narromine, NSW', 'Australia')
    ON CONFLICT DO NOTHING
    RETURNING *
  `);

  if (!farm) {
    console.log('ℹ️  Farm already exists, skipping seed.');
    await db.end(); return;
  }

  console.log(`✅ Farm: ${farm.name}`);

  // 2. Users
  const hash = await bcrypt.hash('password123', 12);
  const users = [
    { name: 'James Whitfield', email: 'owner@farm.com',      role: 'owner'      },
    { name: 'Sarah Mitchell',  email: 'manager@farm.com',    role: 'manager'    },
    { name: 'Tom Briggs',      email: 'staff@farm.com',      role: 'staff'      },
    { name: 'Dr. Claire Ng',   email: 'agro@farm.com',       role: 'agronomist' },
    { name: 'AgriSupply Co',   email: 'supplier@farm.com',   role: 'supplier'   },
  ];

  const userRows = [];
  for (const u of users) {
    const { rows: [user] } = await db.query(
      `INSERT INTO users (name, email, password_hash, role, farm_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [u.name, u.email, hash, u.role, farm.id],
    );
    userRows.push(user);
    console.log(`✅ User: ${user.name} (${user.role})`);
  }

  const [owner, manager, staff, agro, supplier] = userRows;

  // 3. Paddocks
  const paddockData = [
    { name: 'North Block',   area: 87.5,  crop: 'Wheat' },
    { name: 'South Flat',    area: 62.0,  crop: 'Canola' },
    { name: 'Creek Paddock', area: 45.3,  crop: 'Barley' },
    { name: 'Hill Country',  area: 112.0, crop: 'Wheat' },
    { name: 'Home Paddock',  area: 28.5,  crop: 'Oats' },
  ];

  const paddockRows = [];
  for (const p of paddockData) {
    const { rows: [pad] } = await db.query(
      `INSERT INTO paddocks (farm_id, name, land_area, crop_type)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [farm.id, p.name, p.area, p.crop],
    );
    paddockRows.push(pad);
    console.log(`✅ Paddock: ${pad.name}`);
  }

  const [north, south, creek, hill, home] = paddockRows;

  // 4. Recommendations
  const recData = [
    { paddock_id: north.id, agronomist_id: agro.id, type: 'Fertiliser', description: 'Apply 80kg/ha Urea pre-rain window. Soil N deficiency confirmed by recent test.', status: 'approved' },
    { paddock_id: south.id, agronomist_id: agro.id, type: 'Spray',      description: 'Broadleaf herbicide required — annual ryegrass pressure above threshold in NW corner.', status: 'draft' },
    { paddock_id: creek.id, agronomist_id: agro.id, type: 'Soil Test',  description: 'Full nutrient profile recommended prior to next season planting.', status: 'draft' },
    { paddock_id: hill.id,  agronomist_id: agro.id, type: 'Irrigation', description: 'Drip schedule to be adjusted — moisture sensors reading low at 40cm depth.', status: 'approved' },
    { paddock_id: home.id,  agronomist_id: agro.id, type: 'Harvest',    description: 'Oats ready for harvest. Target moisture 13.5%. Weather window opens Monday.', status: 'draft' },
  ];

  for (const r of recData) {
    await db.query(
      `INSERT INTO recommendations (paddock_id, agronomist_id, type, description, status)
       VALUES ($1,$2,$3,$4,$5)`,
      [r.paddock_id, r.agronomist_id, r.type, r.description, r.status],
    );
  }
  console.log(`✅ ${recData.length} recommendations created`);

  // 5. Timesheets
  const tsData = [
    { user_id: staff.id, paddock_id: north.id, hours: 8,   hourly_rate: 28,   date: '2026-03-24' },
    { user_id: staff.id, paddock_id: south.id, hours: 6.5, hourly_rate: 28,   date: '2026-03-25' },
    { user_id: staff.id, paddock_id: creek.id, hours: 10,  hourly_rate: 28,   date: '2026-03-26' },
    { user_id: staff.id, paddock_id: hill.id,  hours: 7.5, hourly_rate: 30,   date: '2026-03-27' },
    { user_id: staff.id, paddock_id: north.id, hours: 9,   hourly_rate: 28,   date: '2026-03-28' },
  ];

  for (const t of tsData) {
    const { rows: [ts] } = await db.query(
      `INSERT INTO timesheets (user_id, paddock_id, hours, hourly_rate, date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [t.user_id, t.paddock_id, t.hours, t.hourly_rate, t.date],
    );
    await db.query(
      `INSERT INTO financial_transactions (paddock_id, source, reference_id, amount)
       VALUES ($1,'labour',$2,$3)`,
      [t.paddock_id, ts.id, ts.total_cost],
    );
  }
  console.log(`✅ ${tsData.length} timesheet entries created`);

  // 6. Fuel logs
  const fuelData = [
    { paddock_id: north.id, litres: 145.0, price_per_litre: 2.18, date: '2026-03-24' },
    { paddock_id: south.id, litres: 98.5,  price_per_litre: 2.18, date: '2026-03-25' },
    { paddock_id: hill.id,  litres: 220.0, price_per_litre: 2.15, date: '2026-03-26' },
    { paddock_id: creek.id, litres: 60.0,  price_per_litre: 2.20, date: '2026-03-27' },
  ];

  for (const f of fuelData) {
    const { rows: [fl] } = await db.query(
      `INSERT INTO fuel_logs (paddock_id, litres, price_per_litre, date)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [f.paddock_id, f.litres, f.price_per_litre, f.date],
    );
    await db.query(
      `INSERT INTO financial_transactions (paddock_id, source, reference_id, amount)
       VALUES ($1,'fuel',$2,$3)`,
      [f.paddock_id, fl.id, fl.total_cost],
    );
  }
  console.log(`✅ ${fuelData.length} fuel log entries created`);

  // 7. Supplier orders
  const orderData = [
    { paddock_id: north.id, supplier_id: supplier.id, product_name: 'Urea 46%',         quantity: 2000, unit_price: 0.85, status: 'ordered'   },
    { paddock_id: south.id, supplier_id: supplier.id, product_name: 'Roundup 500SL',    quantity: 20,   unit_price: 18.5, status: 'pending'   },
    { paddock_id: creek.id, supplier_id: supplier.id, product_name: 'MAP Fertiliser',   quantity: 1500, unit_price: 0.92, status: 'delivered' },
    { paddock_id: hill.id,  supplier_id: supplier.id, product_name: 'Glyphosate 450g',  quantity: 15,   unit_price: 22.0, status: 'pending'   },
    { paddock_id: home.id,  supplier_id: supplier.id, product_name: 'Seed Treatment',   quantity: 200,  unit_price: 3.40, status: 'ordered'   },
  ];

  for (const o of orderData) {
    const { rows: [ord] } = await db.query(
      `INSERT INTO supplier_orders (paddock_id, supplier_id, product_name, quantity, unit_price, status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [o.paddock_id, o.supplier_id, o.product_name, o.quantity, o.unit_price, o.status],
    );
    await db.query(
      `INSERT INTO financial_transactions (paddock_id, source, reference_id, amount)
       VALUES ($1,'supplier',$2,$3)`,
      [o.paddock_id, ord.id, ord.total_price],
    );
  }
  console.log(`✅ ${orderData.length} supplier orders created`);

  console.log('\n🎉 Seed complete! Login with:');
  console.log('   owner@farm.com     / password123  (owner)');
  console.log('   manager@farm.com   / password123  (manager)');
  console.log('   staff@farm.com     / password123  (staff)');
  console.log('   agro@farm.com      / password123  (agronomist)');
  console.log('   supplier@farm.com  / password123  (supplier)');

  await db.end();
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
