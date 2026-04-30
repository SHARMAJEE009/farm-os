// ============================================================
// FARM OS — Shared Types
// ============================================================

export type UserRole = 'owner' | 'manager' | 'staff' | 'agronomist' | 'supplier';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  farm_id: string | null;
  created_at: string;
}

export interface Farm {
  id: string;
  name: string;
  location: string | null;
  country: string;
  description: string | null;
  state: string | null;
  postcode: string | null;
  total_area_hectares: number | null;
  created_at: string;
}

export interface FarmStats {
  paddock_count: number;
  total_hectares: number;
  cost_this_month: number;
  pending_recommendations: number;
  pending_orders: number;
}

export interface Paddock {
  id: string;
  farm_id: string;
  name: string;
  crop_type: string | null;
  boundary_geojson: object | null;
  latitude: number | null;
  longitude: number | null;
  land_area: number | null;
  sowing_date: string | null;
  created_at: string;
}

export type RecommendationStatus = 'draft' | 'approved' | 'rejected';

export interface Recommendation {
  id: string;
  paddock_id: string;
  agronomist_id: string | null;
  type: string;
  description: string | null;
  status: RecommendationStatus;
  created_at: string;
  paddock?: Paddock;
  agronomist?: User;
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  amount: number;
  method: string | null;
  status: PaymentStatus;
  paid_at: string | null;
  created_at: string;
}

export type OrderStatus = 'pending' | 'ordered' | 'delivered';

export interface SupplierOrder {
  id: string;
  supplier_id: string | null;
  paddock_id: string;
  recommendation_id: string | null;
  payment_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: OrderStatus;
  supplier_name: string | null;
  created_at: string;
  paddock?: Paddock;
  supplier?: User;
}

export interface Timesheet {
  id: string;
  user_id: string | null;
  staff_name: string | null;
  paddock_id: string;
  payment_id: string | null;
  hours: number;
  hourly_rate: number;
  total_cost: number;
  date: string;
  user?: User;
  paddock?: Paddock;
}

export interface FuelLog {
  id: string;
  paddock_id: string;
  payment_id: string | null;
  litres: number;
  price_per_litre: number;
  total_cost: number;
  date: string;
  paddock?: Paddock;
}

export type TransactionSource = 'labour' | 'fuel' | 'supplier' | 'livestock';

export interface FinancialTransaction {
  id: string;
  paddock_id: string;
  source: TransactionSource;
  reference_id: string | null;
  amount: number;
  created_at: string;
  paddock?: Paddock;
  // Enriched fields
  product_name?: string | null;
  supplier_name?: string | null;
  staff_name?: string | null;
  fuel_litres?: number | null;
  mob_name?: string | null;
}

// API response wrappers
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

// Dashboard summary types
export interface PaddockSummary {
  paddock: Paddock;
  total_labour_cost: number;
  total_fuel_cost: number;
  total_supplier_cost: number;
  total_cost: number;
  open_recommendations: number;
  pending_orders: number;
}

export interface DashboardStats {
  total_farms: number;
  total_paddocks: number;
  total_hectares: number;
  total_cost_this_month: number;
  pending_recommendations: number;
  pending_orders: number;
  recent_transactions: FinancialTransaction[];
}

// Forecasting types
export interface ForecastingMonth {
  month: string;
  labour: number;
  fuel: number;
  supplier: number;
  total: number;
  projected: boolean;
}

export interface ForecastingData {
  monthly: ForecastingMonth[];
  paddock_monthly: Array<{
    paddock_id: string;
    paddock_name: string;
    month: string;
    total: number;
  }>;
  projection_basis: string;
}

// Benchmarking types
export interface BenchmarkPaddock {
  id: string;
  name: string;
  land_area: number | null;
  crop_type: string | null;
  labour_cost: number;
  fuel_cost: number;
  supplier_cost: number;
  total_cost: number;
  cost_per_hectare: number | null;
  percentile: number | null;
  labour_pct: number;
  fuel_pct: number;
  supplier_pct: number;
}

export interface BenchmarkingData {
  paddocks: BenchmarkPaddock[];
  industry_benchmark: {
    cost_per_hectare: number;
    labour_pct: number;
    fuel_pct: number;
    supplier_pct: number;
  };
}

// News types
export interface NewsItem {
  title: string;
  description: string;
  url: string;
  pubDate: string;
  author: string;
  thumbnail: string | null;
  category: string;
  source: string;
}

export interface NewsResponse {
  items: NewsItem[];
  count: number;
  cached_at: string;
}



// Livestock types
export interface Species {
  id: string;
  name: string;
  weight_unit: string;
  notes: string | null;
  created_at: string;
}

export interface Breed {
  id: string;
  species_id: string;
  name: string;
  typical_mature_weight_kg: number | null;
  purpose: 'meat' | 'dairy' | 'wool' | 'breeding' | 'dual';
  created_at: string;
}

export interface AnimalClass {
  id: string;
  species_id: string;
  name: string;
  created_at: string;
}

export type MobStatus = 'active' | 'sold' | 'deceased' | 'transferred';

export interface Mob {
  id: string;
  name: string;
  species_id: string;
  breed_id: string | null;
  animal_class_id: string | null;
  head_count: number;
  dob_range_start: string | null;
  dob_range_end: string | null;
  source_farm: string | null;
  purchase_date: string | null;
  purchase_price_per_head: number | null;
  status: MobStatus;
  farm_id: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Enriched
  species?: Species;
  breed?: Breed;
  animal_class?: AnimalClass;
  current_paddock_name?: string;
  current_entry_date?: string;
  stocking_rate_per_ha?: number;
}

export interface MobPaddockAssignment {
  id: string;
  mob_id: string;
  paddock_id: string;
  entry_date: string;
  entry_head_count: number;
  exit_date: string | null;
  exit_head_count: number | null;
  exit_reason: 'sold' | 'moved' | 'deceased' | 'other' | null;
  stocking_rate_per_ha: number | null;
  created_at: string;
  paddock?: Paddock;
  mob?: Mob;
}

export interface HealthEvent {
  id: string;
  mob_id: string;
  event_type: 'treatment' | 'vaccination' | 'mortality' | 'condition_score';
  date: string;
  product_used: string | null;
  dose: string | null;
  withholding_period_days: number | null;
  whp_expiry_date: string | null;
  administered_by: string | null;
  head_count_affected: number;
  cause: string | null;
  notes: string | null;
  created_at: string;
}

export interface WeighEvent {
  id: string;
  mob_id: string;
  date: string;
  head_count_weighed: number;
  average_weight_kg: number;
  total_weight_kg: number;
  adg_since_last_kg: number | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ── Agworld Features ──────────────────────────────────────────────

export interface Product {
  id: string;
  name: string;
  category: 'chemical' | 'fertilizer' | 'seed' | 'adjuvant';
  active_ingredient: string | null;
  manufacturer: string | null;
  unit: string;
  default_rate: number | null;
  rate_unit: string | null;
  withholding_period_days: number | null;
  reentry_interval_hours: number | null;
  signal_word: string | null;
  sds_url: string | null;
  notes: string | null;
  farm_id: string | null;
  created_at: string;
}

export interface ActivityProduct {
  id: string;
  product_name: string;
  rate: number | null;
  rate_unit: string | null;
  total_quantity: number | null;
  total_cost: number | null;
}

export type ActivityType = 'spraying' | 'fertilizing' | 'seeding' | 'harvesting' | 'cultivation' | 'irrigation';
export type ActivityStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';

export interface Activity {
  id: string;
  farm_id: string;
  paddock_id: string;
  paddock_name?: string;
  crop_plan_id: string | null;
  recommendation_id: string | null;
  activity_type: ActivityType;
  status: ActivityStatus;
  planned_date: string | null;
  completed_date: string | null;
  operator_name: string | null;
  equipment: string | null;
  wind_speed_kmh: number | null;
  wind_direction: string | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  area_applied_ha: number | null;
  water_rate_lha: number | null;
  notes: string | null;
  cost_amount: number | null;
  products?: ActivityProduct[];
  created_at: string;
}

export type CropPlanStatus = 'planned' | 'active' | 'harvested' | 'abandoned';

export interface CropPlan {
  id: string;
  farm_id: string;
  paddock_id: string;
  paddock_name?: string;
  land_area?: number | null;
  season: string;
  planned_crop: string | null;
  planned_variety: string | null;
  target_yield_per_ha: number | null;
  target_yield_unit: string;
  estimated_revenue_per_ha: number | null;
  estimated_cost_per_ha: number | null;
  actual_yield_per_ha: number | null;
  actual_revenue_per_ha: number | null;
  sowing_date: string | null;
  harvest_date: string | null;
  status: CropPlanStatus;
  notes: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  farm_id: string;
  product_id: string | null;
  product_name: string;
  category: string;
  current_stock: number;
  unit: string;
  reorder_level: number | null;
  location: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  last_updated: string;
  created_at: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';

export interface Task {
  id: string;
  farm_id: string;
  paddock_id: string | null;
  paddock_name?: string;
  title: string;
  description: string | null;
  task_type: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  completed_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  notes: string | null;
  created_at: string;
}

export interface WeatherCurrent {
  temperature_c: number;
  feels_like_c: number;
  humidity_pct: number;
  wind_speed_kmh: number;
  wind_direction: string;
  pressure_hpa: number;
  uv_index: number;
  cloud_cover_pct: number;
  rain_mm_1h: number;
  dew_point_c: number;
  description: string;
  icon: string;
}

export interface WeatherForecastDay {
  date: string;
  day: string;
  high_c: number;
  low_c: number;
  rain_chance_pct: number;
  rain_mm: number;
  wind_kmh: number;
  description: string;
  icon: string;
}

export interface WeatherData {
  current: WeatherCurrent;
  forecast: WeatherForecastDay[];
  location: string;
  cached_at: string;
}

export interface SprayCondition {
  value: number;
  unit: string;
  ok: boolean;
  limit: string;
}

export interface SprayConditions {
  suitable: boolean;
  conditions: Record<string, SprayCondition>;
  recommendation: string;
}

export interface HarvestRecord {
  id: string;
  farm_id: string;
  paddock_id: string;
  paddock_name?: string;
  land_area?: number | null;
  crop_plan_id: string | null;
  harvest_date: string;
  crop: string | null;
  yield_total: number | null;
  yield_unit: string;
  yield_per_ha: number | null;
  moisture_pct: number | null;
  grade: string | null;
  price_per_unit: number | null;
  total_revenue: number | null;
  notes: string | null;
  created_at: string;
}
