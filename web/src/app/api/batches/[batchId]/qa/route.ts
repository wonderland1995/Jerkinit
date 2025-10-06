// src/app/api/batches/[batchId]/qa/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type QAStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional';

type Stage =
  | 'preparation'
  | 'mixing'
  | 'marination'
  | 'drying'
  | 'packaging'
  | 'final'
  | null;

interface CheckpointRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stage: Stage;
  required: boolean;
  display_order: number;
  active: boolean;
}

interface BatchCheckRow {
  id: string;
  checkpoint_id: string;
  status: QAStatus | null;
  checked_at: string | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  ph_level: number | null;
  water_activity: number | null;
  notes: string | null;
  corrective_action: string | null;
  recheck_required: boolean | null;
  metadata: Record<string, unknown> | null;
}

interface CheckpointOut extends CheckpointRow {
  status: QAStatus;
  last_checked_at: string | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  ph_level: number | null;
  water_activity: number | null;
  notes: string | null;
  corrective_action: string | null;
  recheck_required: boolean;
  metadata: Record<string, unknown>;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await context.params;

  const supabase = createClient();

  // 1) Load all active checkpoints
  const { data: cpData, error: cpErr } = await supabase
    .from('qa_checkpoints')
    .select(
      'id, code, name, description, stage, required, display_order, active'
    )
    .eq('active', true)
    .order('stage', { ascending: true })
    .order('display_order', { ascending: true });

  if (cpErr) {
    return NextResponse.json({ error: cpErr.message }, { status: 400 });
  }

  // 2) Load existing batch QA results for this batch
  const { data: chkData, error: chkErr } = await supabase
    .from('batch_qa_checks')
    .select(
      'id, checkpoint_id, status, checked_at, temperature_c, humidity_percent, ph_level, water_activity, notes, corrective_action, recheck_required, metadata'
    )
    .eq('batch_id', batchId);

  if (chkErr) {
    return NextResponse.json({ error: chkErr.message }, { status: 400 });
  }

  const checkpoints = (cpData ?? []) as CheckpointRow[];
  const checks = (chkData ?? []) as BatchCheckRow[];

  const byCheckpoint = new Map<string, BatchCheckRow>();
  for (const r of checks) byCheckpoint.set(r.checkpoint_id, r);

  const out: CheckpointOut[] = checkpoints.map((cp) => {
    const r = byCheckpoint.get(cp.id);
    return {
      ...cp,
      status: (r?.status ?? 'pending') as QAStatus,
      last_checked_at: r?.checked_at ?? null,
      temperature_c: r?.temperature_c ?? null,
      humidity_percent: r?.humidity_percent ?? null,
      ph_level: r?.ph_level ?? null,
      water_activity: r?.water_activity ?? null,
      notes: r?.notes ?? null,
      corrective_action: r?.corrective_action ?? null,
      recheck_required: r?.recheck_required ?? false,
      metadata: r?.metadata ?? {},
    };
  });

  return NextResponse.json({ checkpoints: out });
}
