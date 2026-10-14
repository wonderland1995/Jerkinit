import type { CureType, CureStatus, CurePpmSettings } from './cure';
type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

export interface MaterialTraceRow {
  material_id: string;
  material_name: string;
  unit: Unit;
  target_amount: number;
  used_amount: number;
  remaining_amount: number;
  is_critical: boolean;
  tolerance_percentage: number;
  is_cure?: boolean | null;
  cure_type?: CureType | null;
  cure_nitrite_percent?: number | null;
  cure_required_grams?: number | null;
  cure_ppm_target?: number | null;
  cure_base_mass_grams?: number | null;
  lots: unknown[];
}

export interface TraceResp {
  batch?: { id?: string; recipe_id?: string | null; scale?: number };
  materials?: MaterialTraceRow[];
  cure_settings?: Partial<CurePpmSettings> | null;
  cure_mass_basis_grams?: number | null;
  total_non_cure_mass_grams?: number | null;
  target_non_cure_mass_grams?: number | null;
  actual_non_cure_mass_grams?: number | null;
  actual_beef_mass_grams?: number | null;
  beef_mass_grams_used?: number | null;
  fallback_beef_mass_grams?: number | null;
}

export type BatchStatus = 'in_progress' | 'completed' | 'cancelled' | 'released';

export interface BatchDetails {
  id: string;
  batch_id: string;
  batch_number?: string | null;
  recipe_id: string | null;
  beef_weight_kg: number;
  scaling_factor: number | null;
  production_date: string | null;
  created_at?: string | null;
  best_before_date?: string | null;
  status: BatchStatus;
  release_status?: 'pending' | 'approved' | 'rejected' | 'hold' | 'recalled' | null;
  recall_reason?: string | null;
  recall_notes?: string | null;
  recipe?: { name: string; recipe_code: string };
}

export const resolveBatchDisplayId = (batch: BatchDetails | null | undefined): string =>
  batch?.batch_id ?? batch?.batch_number ?? batch?.id ?? 'Batch';

export interface BatchResp {
  batch?: BatchDetails;
}

export interface ActualRow {
  id: string;
  material_id: string | null;
  ingredient_name: string;
  target_amount: number;
  actual_amount: number | null;
  unit: Unit;
  tolerance_percentage: number;
  in_tolerance: boolean | null;
  measured_at: string | null;
  is_cure?: boolean | null;
  cure_type?: CureType | null;
  cure_ppm?: number | null;
  cure_status?: CureStatus | null;
  cure_required_grams?: number | null;
  cure_unit?: Unit;
  cure_base_mass_grams?: number | null;
}

export interface ActualsResp {
  actuals?: ActualRow[];
}

export type QaStage =
  | 'preparation'
  | 'mixing'
  | 'marination'
  | 'drying'
  | 'packaging'
  | 'final';

export interface QaStageCount {
  stage: QaStage;
  total: number;
  done: number;
}

export interface QaSummaryResp {
  current_stage: QaStage;
  percent_complete: number;
  counts: QaStageCount[];
  current_checkpoint?: { id: string; code: string; name: string; stage: QaStage } | null;
}

export type QaStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional';

export interface QaCheckpointReport {
  id: string;
  code: string;
  name: string;
  stage: QaStage;
  status: QaStatus;
  last_checked_at: string | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  ph_level: number | null;
  water_activity: number | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  description?: string | null;
}

export interface BeefAllocationReport {
  id: string;
  lot_id: string;
  quantity_used: number;
  unit: string;
  allocated_at: string;
  lot?:
    | {
        lot_number?: string | null;
        internal_lot_code?: string | null;
        unit?: string | null;
        supplier?: { name?: string | null } | null;
      }
    | null;
}

export type CoreTempReadingMeta = { tempC?: number | ''; minutes?: number | '' };
export type MarinationTimesMeta = { tempC?: number | ''; startISO?: string | null; endISO?: string | null };

