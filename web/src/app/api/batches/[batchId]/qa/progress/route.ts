import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type Stage = 'preparation' | 'mixing' | 'marination' | 'drying' | 'packaging' | 'final';
const STAGES: Stage[] = ['preparation', 'mixing', 'marination', 'drying', 'packaging', 'final'];

type CheckpointRow = {
  id: string;
  stage: Stage | null;
  required: boolean | null;
  active: boolean | null;
};

type BatchCheckRow = {
  checkpoint_id: string | null;
  status: 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional' | null;
};

type StageProgress = {
  stage: Stage;
  required_total: number;
  required_passed: number;
  percent: number; // 0..100
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const { batchId } = params;
  const supabase = createClient();

  // 1) Fetch active checkpoints
  const { data: checkpoints, error: cpErr } = await supabase
    .from('qa_checkpoints')
    .select('id, stage, required, active') as unknown as { data: CheckpointRow[] | null; error: { message: string } | null };

  if (cpErr) {
    return NextResponse.json({ error: cpErr.message }, { status: 500 });
  }

  const activeCheckpoints = (checkpoints ?? []).filter(c => c.active === true && c.stage !== null);

  // 2) Fetch this batch's QA checks
  const { data: checks, error: chErr } = await supabase
    .from('batch_qa_checks')
    .select('checkpoint_id, status')
    .eq('batch_id', batchId) as unknown as { data: BatchCheckRow[] | null; error: { message: string } | null };

  if (chErr) {
    return NextResponse.json({ error: chErr.message }, { status: 500 });
  }

  const checkMap = new Map<string, BatchCheckRow>();
  for (const row of checks ?? []) {
    if (row.checkpoint_id) checkMap.set(row.checkpoint_id, row);
  }

  // 3) Compute per-stage required vs passed
  const stageTotals = new Map<Stage, number>();
  const stagePassed = new Map<Stage, number>();
  STAGES.forEach(s => {
    stageTotals.set(s, 0);
    stagePassed.set(s, 0);
  });

  for (const cp of activeCheckpoints) {
    const st = (cp.stage ?? 'preparation') as Stage;
    const isRequired = cp.required === true;
    if (isRequired) {
      stageTotals.set(st, (stageTotals.get(st) ?? 0) + 1);
      const chk = cp.id ? checkMap.get(cp.id) : undefined;
      if (chk && chk.status === 'passed') {
        stagePassed.set(st, (stagePassed.get(st) ?? 0) + 1);
      }
    }
  }

  const stages: StageProgress[] = STAGES.map(stage => {
    const total = stageTotals.get(stage) ?? 0;
    const passed = stagePassed.get(stage) ?? 0;
    const percent = total === 0 ? 100 : Math.round((passed / total) * 100);
    return { stage, required_total: total, required_passed: passed, percent };
  });

  // 4) Determine current stage (first stage with missing required)
  let current_stage: Stage | null = null;
  for (const s of stages) {
    if (s.required_passed < s.required_total) {
      current_stage = s.stage;
      break;
    }
  }

  // 5) Can complete = all required passed across all stages
  const can_complete = stages.every(s => s.required_passed >= s.required_total);

  return NextResponse.json({ current_stage, stages, can_complete });
}
