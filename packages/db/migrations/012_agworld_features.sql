-- ============================================================
-- Migration 012: Agworld Feature Parity
-- Activities, Product Library, Crop Plans, Inventory, Tasks, Weather
-- ============================================================

-- 1. Product Library (Chemical/Fertilizer database)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'chemical', -- chemical, fertilizer, seed, adjuvant
  active_ingredient VARCHAR(255),
  manufacturer VARCHAR(255),
  unit VARCHAR(50) DEFAULT 'L', -- L, kg, mL, g
  default_rate DECIMAL(10,3),
  rate_unit VARCHAR(50), -- L/ha, kg/ha, mL/ha
  withholding_period_days INT,
  reentry_interval_hours INT,
  signal_word VARCHAR(50), -- Caution, Warning, Danger
  sds_url VARCHAR(500),
  notes TEXT,
  farm_id UUID REFERENCES farms(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crop Plans (Seasonal planning per paddock)
CREATE TABLE IF NOT EXISTS crop_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  paddock_id UUID NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
  season VARCHAR(50) NOT NULL, -- '2026 Winter', '2026 Summer'
  planned_crop VARCHAR(100),
  planned_variety VARCHAR(100),
  target_yield_per_ha DECIMAL(10,2),
  target_yield_unit VARCHAR(20) DEFAULT 't/ha',
  estimated_revenue_per_ha DECIMAL(10,2),
  estimated_cost_per_ha DECIMAL(10,2),
  actual_yield_per_ha DECIMAL(10,2),
  actual_revenue_per_ha DECIMAL(10,2),
  sowing_date DATE,
  harvest_date DATE,
  status VARCHAR(20) DEFAULT 'planned', -- planned, active, harvested, abandoned
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Activities / Spray Journal
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  paddock_id UUID NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
  crop_plan_id UUID REFERENCES crop_plans(id) ON DELETE SET NULL,
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) NOT NULL, -- spraying, fertilizing, seeding, harvesting, cultivation, irrigation
  status VARCHAR(20) DEFAULT 'planned', -- planned, in_progress, completed, cancelled
  planned_date DATE,
  completed_date DATE,
  operator_name VARCHAR(255),
  equipment VARCHAR(255),
  wind_speed_kmh DECIMAL(5,1),
  wind_direction VARCHAR(10),
  temperature_c DECIMAL(4,1),
  humidity_pct DECIMAL(4,1),
  area_applied_ha DECIMAL(10,2),
  water_rate_lha DECIMAL(10,2),
  notes TEXT,
  cost_amount DECIMAL(10,2),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Activity Products (products used per activity)
CREATE TABLE IF NOT EXISTS activity_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  rate DECIMAL(10,3),
  rate_unit VARCHAR(50),
  total_quantity DECIMAL(10,3),
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2)
);

-- 5. Inventory / Shed
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  category VARCHAR(50) DEFAULT 'chemical',
  current_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'L',
  reorder_level DECIMAL(10,3),
  location VARCHAR(255), -- shed name or area
  batch_number VARCHAR(100),
  expiry_date DATE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Inventory Transactions (usage tracking)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  transaction_type VARCHAR(20) NOT NULL, -- received, used, adjustment, disposed
  quantity DECIMAL(10,3) NOT NULL,
  notes VARCHAR(500),
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tasks / Work Orders
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  paddock_id UUID REFERENCES paddocks(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  task_type VARCHAR(50) DEFAULT 'general', -- spraying, fertilizing, fencing, maintenance, livestock, general
  priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent
  status VARCHAR(20) DEFAULT 'pending', -- pending, assigned, in_progress, completed, cancelled
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_name VARCHAR(255),
  due_date DATE,
  completed_date DATE,
  estimated_hours DECIMAL(5,1),
  actual_hours DECIMAL(5,1),
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Weather Cache
CREATE TABLE IF NOT EXISTS weather_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  current_data JSONB,
  forecast_data JSONB,
  location_name VARCHAR(255),
  latitude DECIMAL(10,6),
  longitude DECIMAL(10,6)
);

-- 9. Harvest Records
CREATE TABLE IF NOT EXISTS harvest_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  paddock_id UUID NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
  crop_plan_id UUID REFERENCES crop_plans(id) ON DELETE SET NULL,
  harvest_date DATE NOT NULL,
  crop VARCHAR(100),
  yield_total DECIMAL(10,2),
  yield_unit VARCHAR(20) DEFAULT 'tonnes',
  yield_per_ha DECIMAL(10,2),
  moisture_pct DECIMAL(4,1),
  grade VARCHAR(50),
  price_per_unit DECIMAL(10,2),
  total_revenue DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activities_farm ON activities(farm_id);
CREATE INDEX IF NOT EXISTS idx_activities_paddock ON activities(paddock_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_crop_plans_farm ON crop_plans(farm_id);
CREATE INDEX IF NOT EXISTS idx_crop_plans_paddock ON crop_plans(paddock_id);
CREATE INDEX IF NOT EXISTS idx_inventory_farm ON inventory(farm_id);
CREATE INDEX IF NOT EXISTS idx_tasks_farm ON tasks(farm_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_harvest_records_farm ON harvest_records(farm_id);
