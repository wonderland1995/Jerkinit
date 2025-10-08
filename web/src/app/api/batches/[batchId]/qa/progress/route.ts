// src/app/api/batches/[batchId]/qa/progress/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type Stage = 'preparation' | 'mixing' | 'marination' | 'drying' | 'packaging' | 'final';

type Checkpoint = {
  id: string;
  code?: string | null;
  name?: string | null;
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
  percentage: number;
};

const STAGE_ORDER: Stage[] = ['preparation', 'mixing', 'marination', 'drying', 'packaging', 'final'];

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ batchId: string }> }
) {
  const params = await props.params;
  const { batchId } = params;
  const supabase = createClient();

  // 1) Load active checkpoints
  const { data: cpRows, error: cpErr } = await supabase
    .from('qa_checkpoints')
    .select('id, code, name, stage, required, active, display_order')
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

  // Determine the next/current checkpoint within the current stage
  let current_checkpoint: { id: string; code: string; name: string; stage: Stage } | null = null;
  if (current_stage) {
    const statusById = new Map<string, BatchCheckStatus>();
    for (const c of checks) statusById.set(c.checkpoint_id, c.status);

    const stageCps = checkpoints
      .filter((cp) => cp.stage === current_stage)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

    const firstRequiredNotPassed = stageCps.find((cp) => cp.required && statusById.get(cp.id) !== 'passed');
    const firstOptionalNotPassed = stageCps.find((cp) => !cp.required && statusById.get(cp.id) !== 'passed');
    const chosen = firstRequiredNotPassed ?? firstOptionalNotPassed;
    if (chosen) {
      current_checkpoint = {
        id: chosen.id,
        code: String(chosen.code ?? ''),
        name: String(chosen.name ?? ''),
        stage: current_stage,
      };
    }
  }

  // Calculate overall percent complete
  const totalRequired = stages.reduce((sum, sp) => sum + sp.total_required, 0);
  const totalCompleted = stages.reduce((sum, sp) => sum + sp.completed_required, 0);
  const percent_complete = totalRequired === 0 ? 100 : Math.round((totalCompleted / totalRequired) * 100);

  // You can complete batch only if all required items across all stages are passed
  const can_complete = stages.every((sp) => sp.completed_required >= sp.total_required);

  // Return in the format expected by the batch detail page
  const counts = stages.map(sp => ({
    stage: sp.stage,
    total: sp.total_required,
    done: sp.completed_required,
  }));

  return NextResponse.json({ 
    current_stage, 
    percent_complete,
    counts,
    stages, 
    can_complete,
    current_checkpoint,
  });
}
