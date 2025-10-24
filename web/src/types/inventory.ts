// ============================================
// CORE TYPES
// ============================================

export interface Supplier {
  id: string;
  name: string;
  supplier_code: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  certification_status: 'approved' | 'pending' | 'suspended' | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  name: string;
  material_code: string;
  category: 'beef' | 'spice' | 'packaging' | 'additive' | 'other';
  unit: 'g' | 'kg' | 'ml' | 'L' | 'units';
  reorder_point: number | null;
  storage_conditions: string | null;
  shelf_life_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lot {
  id: string;
  material_id: string;
  supplier_id: string | null;
  lot_number: string;
  internal_lot_code: string;
  received_date: string;
  expiry_date: string | null;
  quantity_received: number;
  current_balance: number;
  unit_cost: number | null;
  certificate_of_analysis_url: string | null;
  status: 'available' | 'quarantine' | 'depleted' | 'recalled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  material?: Material;
  supplier?: Supplier;
}

export type LotEventType = 
  | 'receive' 
  | 'consume' 
  | 'adjust' 
  | 'scrap' 
  | 'return' 
  | 'quarantine' 
  | 'release';

export interface LotEvent {
  id: string;
  lot_id: string;
  event_type: LotEventType;
  quantity: number;
  balance_after: number;
  batch_id: string | null;
  reason: string | null;
  user_id: string | null;
  created_at: string;
  
  // Joined fields
  lot?: Lot;
}

export interface Recipe {
  id: string;
  name: string;
  recipe_code: string;
  product_category: string | null;
  base_beef_weight: number;
  target_yield_weight: number | null;
  description: string | null;
  instructions: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Joined
  ingredients?: RecipeIngredient[];
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  material_id: string;
  quantity: number;
  unit: string;
  is_critical: boolean;
  notes: string | null;
  created_at: string;
  
  // Joined
  material?: Material;
}

export interface BatchLotUsage {
  id: string;
  batch_id: string;
  lot_id: string;
  material_id: string;
  quantity_used: number;
  unit: string;
  allocated_at: string;
  
  // Joined
  lot?: Lot;
  material?: Material;
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface ReceiveLotRequest {
  material_id: string;
  supplier_id: string | null;
  lot_number: string;
  received_date: string;
  expiry_date: string | null;
  quantity_received: number;
  unit_cost: number | null;
  certificate_of_analysis_url: string | null;
  notes: string | null;
}

export interface CreateRecipeRequest {
  name: string;
  recipe_code: string;
  product_category: string | null;
  base_beef_weight: number;
  target_yield_weight: number | null;
  description: string | null;
  instructions: string | null;
  ingredients: Array<{
    material_id: string;
    quantity: number;
    unit: string;
    is_critical: boolean;
    notes: string | null;
  }>;
}

export interface AllocateLotsRequest {
  batch_id: string;
  material_id: string;
  quantity_needed: number;
}

export interface LotAllocation {
  lot_id: string;
  lot_number: string;
  quantity_allocated: number;
  remaining_balance: number;
}

export interface InventoryDashboardStats {
  total_materials: number;
  low_stock_count: number;
  expiring_soon_count: number; // within 30 days
  total_lot_value: number;
  materials_by_category: Record<string, number>;
}

// ============================================
// VIEW MODELS (for UI)
// ============================================

export interface LotWithDetails extends Lot {
  material_name: string;
  supplier_name: string | null;
  days_until_expiry: number | null;
  utilization_percentage: number; // (quantity_received - current_balance) / quantity_received * 100
}

export interface MaterialInventorySummary {
  material: Material;
  total_on_hand: number;
  lot_count: number;
  oldest_lot_date: string | null;
  nearest_expiry_date: string | null;
  is_low_stock: boolean;
}

// Keep all the types from before, but add these connections to existing types

export interface Batch {
  id: string;
  batch_id: string; // Your existing batch_id field
  product_id: string;
  recipe_id: string | null;
  beef_weight_kg: number;
  scaling_factor: number | null;
  status: 'in_progress' | 'completed' | 'cancelled';
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
  
  // Joined
  product?: Product;
  recipe?: Recipe;
  lot_usage?: BatchLotUsage[];
}

export interface Product {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BatchIngredient {
  id: string;
  batch_id: string;
  material_id: string | null; // New field
  ingredient_name: string;
  target_amount: number;
  actual_amount: number | null;
  unit: string;
  tolerance_percentage: number;
  is_cure: boolean;
  in_tolerance: boolean | null;
  measured_at: string | null;
  measured_by: string | null;
  
  // Joined
  material?: Material;
}

// Legacy compatibility
export interface RawMaterialLot {
  id: string;
  batch_id: string | null;
  material_type: string;
  material_name: string;
  supplier_id: string | null;
  supplier_lot_number: string | null;
  internal_lot_number: string | null;
  received_date: string | null;
  expiry_date: string | null;
  quantity: number | null;
  unit: string | null;
  certificate_of_analysis: string | Record<string, unknown> | null;
  passed_receiving_qa: boolean;
  storage_location: string | null;
  notes: string | null;
  created_at: string;
}
