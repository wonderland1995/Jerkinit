// src/types/database.ts

export interface Product {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecipeTemplate {
  id: string;
  product_id: string;
  ingredient_name: string;
  per_kg_amount: number;
  unit: IngredientUnit;
  tolerance_percentage: number;
  is_cure: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Batch {
  id: string;
  batch_id: string;
  product_id: string;
  beef_weight_kg: number;
  status: BatchStatus;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  notes: string | null;
}

export interface BatchIngredient {
  id: string;
  batch_id: string;
  ingredient_name: string;
  target_amount: number;
  actual_amount: number | null;
  unit: IngredientUnit;
  tolerance_percentage: number;
  is_cure: boolean;
  in_tolerance: boolean | null;
  measured_at: string | null;
  measured_by: string | null;
}

export type IngredientUnit = 'g' | 'kg' | 'ml' | 'L' | 'tsp' | 'tbsp';
export type BatchStatus = 'in_progress' | 'completed' | 'cancelled';

// API Response Types
export interface CreateBatchResponse {
  batch_id: string;
  batch_uuid: string;
  product_name: string;
  ingredients: ScaledIngredient[];
  beef_weight_kg: number | null;
}

export interface ScaledIngredient {
  ingredient_name: string;
  target_amount: number;
  unit: IngredientUnit;
  tolerance_percentage: number;
  is_cure: boolean;
  display_order: number;
}

export interface ProductListResponse {
  products: Product[];
}

export interface ApiError {
  error: string;
  details?: unknown;
}

// Form Data Types
export interface CreateBatchRequest {
  product_id: string;
  beef_weight_kg: number;
  created_by?: string;
}

export interface UpdateIngredientRequest {
  batch_id: string;
  ingredient_name: string;
  actual_amount: number;
  measured_by?: string;
}

// UI State Types
export interface RecipeLineItem extends ScaledIngredient {
  actual_amount: number | null;
  in_tolerance: boolean | null;
}

export interface RecipeFormState {
  selectedProductId: string;
  beefWeight: string;
  operatorName: string;
  isLoading: boolean;
  error: string | null;
}

export interface BatchRecipeState {
  batchId: string | null;
  batchUuid: string | null;
  productName: string | null;
  ingredients: RecipeLineItem[];
  isComplete: boolean;
  beefWeightKg: number | null;
}