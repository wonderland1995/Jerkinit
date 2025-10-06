// src/app/api/batches/[batchId]/qa/[checkpointId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type QAStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional';

interface SaveBody {
  status: QAStatus;
  metadata?: Record<string, unknown>;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ batchId: string; checkpointId: string }> }
) {
  const { batchId, checkpointId } = await ctx.params; // <-- KEY FIX
  const supabase = createClient();

  let body: SaveBody;
  try {
    body = (await req.json()) as SaveBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ALLOWED = ['pending', 'passed', 'failed', 'skipped', 'conditional'] as const;
  if (!ALLOWED.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // find existing check for this batch + checkpoint
  const { data: existing, error: findErr } = await supabase
    .from('batch_qa_checks')
    .select('id')
    .eq('batch_id', batchId)
    .eq('checkpoint_id', checkpointId)
    .limit(1)
    .maybeSingle();

  if (findErr) {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  if (existing?.id) {
    const { error: updErr } = await supabase
      .from('batch_qa_checks')
      .update({
        status: body.status,
        metadata: body.metadata ?? {},
        checked_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  } else {
    const { error: insErr } = await supabase
      .from('batch_qa_checks')
      .insert({
        batch_id: batchId,
        checkpoint_id: checkpointId,
        status: body.status,
        metadata: body.metadata ?? {},
        checked_at: new Date().toISOString(),
      });

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
