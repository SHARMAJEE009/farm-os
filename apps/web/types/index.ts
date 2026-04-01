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
  location: string;
  country: string;
  created_at: string;
}

export interface Paddock {
  id: string;
  farm_id: string;
  name: string;
  area_hectares: number | null;
  crop_type: string | null;
  boundary_geojson: object | null;
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
  created_at: string;
  paddock?: Paddock;
  supplier?: User;
}

export interface Timesheet {
  id: string;
  user_id: string;
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

export type TransactionSource = 'labour' | 'fuel' | 'supplier';

export interface FinancialTransaction {
  id: string;
  paddock_id: string;
  source: TransactionSource;
  reference_id: string | null;
  amount: number;
  created_at: string;
  paddock?: Paddock;
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
