// src/types/qa.ts

import type { Batch, BatchIngredient } from '@/types/database';
export type { Batch, BatchIngredient } from './database';
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface QADocumentType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  required_for_batch: boolean;
  required_for_release: boolean;
  retention_days: number;
  active: boolean;
  created_at: string;
}

export interface QADocument {
  id: string;
  batch_id: string;
  document_type_id: string;
  document_number: string;
  file_url: string | null;
  file_name: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  uploaded_by: string | null;
  uploaded_at: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  expires_at: string | null;
}

export interface QACheckpoint {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stage: 'preparation' | 'mixing' | 'marination' | 'drying' | 'packaging' | 'final';
  required: boolean;
  display_order: number;
  active: boolean;
  created_at: string;
}

export interface BatchQACheck {
  id: string;
  batch_id: string;
  checkpoint_id: string;
  status: 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional';
  checked_by: string | null;
  checked_at: string | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  ph_level: number | null;
  water_activity: number | null;
  notes: string | null;
  corrective_action: string | null;
  recheck_required: boolean;
  metadata: Record<string, any>;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_info: Record<string, any>;
  certification_info: Record<string, any>;
  approved: boolean;
  approved_date: string | null;
  next_audit_date: string | null;
  active: boolean;
  created_at: string;
}

export interface RawMaterialLot {
  id: string;
  batch_id: string;
  material_type: 'beef' | 'ingredient' | 'packaging';
  material_name: string;
  supplier_id: string | null;
  supplier_lot_number: string | null;
  internal_lot_number: string;
  received_date: string;
  expiry_date: string | null;
  quantity: number;
  unit: string;
  certificate_of_analysis: Record<string, any>;
  passed_receiving_qa: boolean;
  storage_location: string | null;
  notes: string | null;
  created_at: string;
}

export interface ProductTesting {
  id: string;
  batch_id: string;
  test_type: 'microbiological' | 'chemical' | 'physical' | 'sensory' | 'nutritional';
  test_name: string;
  test_method: string | null;
  specification_min: number | null;
  specification_max: number | null;
  result_value: number | null;
  result_text: string | null;
  unit: string | null;
  passed: boolean | null;
  tested_by: string | null;
  tested_at: string | null;
  lab_name: string | null;
  certificate_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface BatchRelease {
  id: string;
  batch_id: string;
  release_status: 'pending' | 'approved' | 'rejected' | 'hold' | 'recalled';
  release_number: string;
  all_qa_passed: boolean;
  all_tests_passed: boolean;
  all_docs_complete: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  hold_reason: string | null;
  recall_reason: string | null;
  customer_complaints: number;
  notes: string | null;
  created_at: string;
}

export interface AuditTrail {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  changed_by: string | null;
  changed_at: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
}

export interface BatchComplianceSummary {
  batch_id: string;
  batch_number: string;
  product_name: string;
  batch_status: string;
  created_at: string;
  completed_at: string | null;
  total_ingredients: number;
  measured_ingredients: number;
  in_tolerance_count: number;
  tolerance_compliance_percent: number;
  required_checkpoints: number;
  passed_checkpoints: number;
  required_documents: number;
  approved_documents: number;
  release_status: string | null;
  release_number: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

// API Request/Response Types
export interface CreateQACheckRequest {
  batch_id: string;
  checkpoint_id: string;
  status: string;
  notes?: string;
  checked_by?: string;
  temperature_c?: number;
  humidity_percent?: number;
  ph_level?: number;
  water_activity?: number;
  corrective_action?: string;
}

export interface UploadDocumentRequest {
  batch_id: string;
  document_type_id: string;
  file: File;
  uploaded_by?: string;
  notes?: string;
}

export interface CompleteBatchRequest {
  batch_id: string;
  completed_by?: string;
}

export interface CompleteBatchResponse {
  success: boolean;
  message: string;
  release_status?: string;
  failed_checks?: string[];
  missing_docs?: string[];
}

export interface BatchQADataResponse {
  batch: Batch & {
    product_name: string;
    tolerance_compliance: number;
  };
  ingredients: BatchIngredient[];
  checkpoints: (QACheckpoint & { check?: BatchQACheck })[];
  documents: (QADocument & { document_type_name: string })[];
  raw_materials?: RawMaterialLot[];
  testing?: ProductTesting[];
  release?: BatchRelease;
  audit_trail?: AuditTrail[];
}