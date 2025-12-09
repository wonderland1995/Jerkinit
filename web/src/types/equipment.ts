export type EquipmentStatus = 'active' | 'out_of_service' | 'retired';

export interface Equipment {
  id: string;
  label_code: string;
  name: string;
  type: string;
  model: string | null;
  serial_number: string | null;
  location: string | null;
  status: EquipmentStatus;
  calibration_interval_days: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EquipmentCalibration {
  id: string;
  equipment_id: string;
  performed_at: string;
  performed_by: string | null;
  method: string | null;
  reference_ice_c: number | null;
  reference_boiling_c: number | null;
  observed_ice_c: number | null;
  observed_boiling_c: number | null;
  adjustment: string | null;
  result: string | null;
  notes: string | null;
  next_due_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EquipmentWithCalibration extends Equipment {
  latest_calibration_id?: string | null;
  latest_calibrated_at?: string | null;
  latest_calibration_result?: string | null;
  latest_calibration_due_at?: string | null;
  observed_ice_c?: number | null;
  observed_boiling_c?: number | null;
  adjustment?: string | null;
}
