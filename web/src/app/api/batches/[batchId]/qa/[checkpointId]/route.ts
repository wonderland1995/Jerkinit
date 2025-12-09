// src/app/api/batches/[batchId]/qa/[checkpointId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type QAStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional';

interface PostBody {
  status: QAStatus;
  checked_at?: string | null;
  notes?: string | null;
  corrective_action?: string | null;
  recheck_required?: boolean;
  temperature_c?: number | null;
  humidity_percent?: number | null;
  ph_level?: number | null;
  water_activity?: number | null;
  metadata?: Record<string, unknown> | null;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ batchId: string; checkpointId: string }> }
) {
  const { batchId, checkpointId } = await context.params;
  const supabase = createClient();

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.status) {
    return NextResponse.json({ error: 'status is required' }, { status: 400 });
  }

  const checkedAtIso = (() => {
    if (!body.checked_at) return null;
    const d = new Date(body.checked_at);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  })();

  const fields = {
    status: body.status,
    notes: body.notes ?? null,
    corrective_action: body.corrective_action ?? null,
    recheck_required: body.recheck_required ?? false,
    temperature_c: body.temperature_c ?? null,
    humidity_percent: body.humidity_percent ?? null,
    ph_level: body.ph_level ?? null,
    water_activity: body.water_activity ?? null,
    metadata: body.metadata ?? {},
  };

  if (checkedAtIso) {
    (fields as { checked_at?: string }).checked_at = checkedAtIso;
  }

  // Check if a row already exists for this batch/checkpoint
  const { data: existingRows, error: selErr } = await supabase
    .from('batch_qa_checks')
    .select('id')
    .eq('batch_id', batchId)
    .eq('checkpoint_id', checkpointId)
    .limit(1);

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 400 });
  }

  if (existingRows && existingRows.length > 0) {
    const id = existingRows[0].id as string;
    if (!checkedAtIso) {
      delete (fields as { checked_at?: string }).checked_at;
    }
    const { error: updErr } = await supabase
      .from('batch_qa_checks')
      .update(fields)
      .eq('id', id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }
  } else {
    const insertCheckedAt = checkedAtIso ?? new Date().toISOString();
    const { error: insErr } = await supabase
      .from('batch_qa_checks')
      .insert([{ batch_id: batchId, checkpoint_id: checkpointId, checked_at: insertCheckedAt, ...fields }]);

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
