// src/app/api/batches/[batchId]/qa/progress/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

// Stages we support in your schema
type Stage = 'preparation' | 'mixing' | 'marination' | 'drying' | 'packaging' | 'final';

type Checkpoint = {
  id: string;
  stage: Stage | null;
  required: boolean;
  active: boolean;
  display_order: number | null;
};

type BatchCheckStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional' | null;

type BatchCheck = {
  checkpoint_id: string;
  status: BatchCheckStatus;
};

type StageProgress = {
  stage: Stage;
  total_required: number;
  completed_required: number;
  percentage: number; // 0..100
};

const STAGE_ORDER: Stage[] = ['preparation', 'mixing', 'marination', 'drying', 'packaging', 'final'];

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ batchId: string }> }   // <-- Next 15 shape
) {
  const { batchId } = await context.params;            // <-- await the params
  const supabase = createClient();

  // 1) Load active checkpoints
  const { data: cpRows, error: cpErr } = await supabase
    .from('qa_checkpoints')
    .select('id, stage, required, active, display_order')
    .eq('active', true)
    .order('stage', { ascending: true })
    .order('display_order', { ascending: true });

  if (cpErr) {
    return NextResponse.json({ error: cpErr.message }, { status: 500 });
  }

  const checkpoints = (cpRows ?? []) as Checkpoint[];

  // 2) Load batch checks for this batch
  const { data: chkRows, error: chErr } = await supabase
    .from('batch_qa_checks')
    .select('checkpoint_id, status')
    .eq('batch_id', batchId);

  if (chErr) {
    return NextResponse.json({ error: chErr.message }, { status: 500 });
  }

  const checks = (chkRows ?? []) as BatchCheck[];

  // Build lookup sets for progress calc
  const requiredByStage = new Map<Stage, string[]>();
  STAGE_ORDER.forEach((s) => requiredByStage.set(s, []));

  for (const cp of checkpoints) {
    if (!cp.stage || !cp.required) continue;
    requiredByStage.get(cp.stage)!.push(cp.id);
  }

  const passed = new Set<string>();
  for (const c of checks) {
    if (c.status === 'passed') passed.add(c.checkpoint_id);
  }

  const stages: StageProgress[] = STAGE_ORDER.map((s) => {
    const ids = requiredByStage.get(s) ?? [];
    const completed = ids.filter((id) => passed.has(id)).length;
    const percentage = ids.length === 0 ? 100 : Math.round((completed / ids.length) * 100);
    return {
      stage: s,
      total_required: ids.length,
      completed_required: completed,
      percentage,
    };
  });

  // Current stage = first stage with incomplete required checkpoints, else 'final'
  const current_stage =
    stages.find((sp) => sp.completed_required < sp.total_required)?.stage ?? 'final';

  // You can complete batch only if all required items across all stages are passed
  const can_complete = stages.every((sp) => sp.completed_required >= sp.total_required);

  return NextResponse.json({ current_stage, stages, can_complete });
}
