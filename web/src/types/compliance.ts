export type ComplianceFrequencyType =
  | 'weekly'
  | 'fortnightly'
  | 'monthly'
  | 'batch_interval'
  | 'custom';

export interface ComplianceTask {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  frequency_type: ComplianceFrequencyType;
  frequency_value: number;
  proof_required: boolean;
  active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ComplianceLog {
  id: string;
  compliance_task_id: string;
  completed_at: string;
  completed_by: string | null;
  result: string | null;
  notes: string | null;
  proof_url: string | null;
  proof_filename: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type ComplianceTaskStatus =
  | 'not_started'
  | 'on_track'
  | 'due_soon'
  | 'overdue'
  | 'batch_due';

export interface ComplianceTaskWithStatus extends ComplianceTask {
  latest_log: ComplianceLog | null;
  log_count: number;
  next_due_at: string | null;
  status: ComplianceTaskStatus;
  days_overdue: number | null;
  batches_since_last: number | null;
  batches_remaining: number | null;
}
