import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type Stage = 'preparation' | 'mixing' | 'marination' | 'drying' | 'packaging' | 'final';

type CheckpointRow = {
  id: string;
  stage: Stage | null;
  required: boolean | null;
  active: boolean | null;
};

type BatchRow = {
  id: string;
  status: 'in_progress' | 'completed' | 'cancelled';
};

type BatchCheckRow = {
  checkpoint_id: string | null;
  status: 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional' | null;
};

export async function POST(
  _req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const { batchId } = params;
  const supabase = createClient();

  // Check batch status first
  const { data: batch, error: bErr } = await supabase
    .from('batches')
    .select('id, status')
    .eq('id', batchId)
    .single() as unknown as { data: BatchRow | null; error: { message: string } | null };

  if (bErr || !batch) {
    return NextResponse.json({ error: bErr?.message ?? 'Batch not found' }, { status: 404 });
  }
  if (batch.status === 'completed') {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  // Get active checkpoints
  const { data: checkpoints, error: cpErr } = await supabase
    .from('qa_checkpoints')
    .select('id, stage, required, active') as unknown as { data: CheckpointRow[] | null; error: { message: string } | null };
  if (cpErr) {
    return NextResponse.json({ error: cpErr.message }, { status: 500 });
  }
  const requiredIds = new Set(
    (checkpoints ?? [])
      .filter(c => c.active === true && c.required === true && c.id)
      .map(c => c.id as string)
  );

  // Get this batch's QA checks
  const { data: checks, error: chErr } = await supabase
    .from('batch_qa_checks')
    .select('checkpoint_id, status')
    .eq('batch_id', batchId) as unknown as { data: BatchCheckRow[] | null; error: { message: string } | null };
  if (chErr) {
    return NextResponse.json({ error: chErr.message }, { status: 500 });
  }

  // Verify all required have status=passed
  const checkMap = new Map<string, BatchCheckRow>();
  for (const c of checks ?? []) {
    if (c.checkpoint_id) checkMap.set(c.checkpoint_id, c);
  }

  const missingOrNotPassed: string[] = [];
  requiredIds.forEach(id => {
    const row = checkMap.get(id);
    if (!row || row.status !== 'passed') {
      missingOrNotPassed.push(id);
    }
  });

  if (missingOrNotPassed.length > 0) {
    return NextResponse.json(
      { error: 'Required QA not complete', missing: missingOrNotPassed },
      { status: 400 }
    );
  }

  // All good — mark batch completed & lock
  const { error: updErr } = await supabase
    .from('batches')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', batchId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
