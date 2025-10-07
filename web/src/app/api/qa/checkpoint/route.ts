// src/app/api/qa/checkpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type QAStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional';

interface PostBody {
  batch_id: string;
  checkpoint_id: string;
  status: QAStatus;
  checked_by?: string | null;
  notes?: string | null;
  corrective_action?: string | null;
  recheck_required?: boolean;
  temperature_c?: number | null;
  humidity_percent?: number | null;
  ph_level?: number | null;
  water_activity?: number | null;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.batch_id || !body.checkpoint_id || !body.status) {
    return NextResponse.json({ error: 'batch_id, checkpoint_id, and status are required' }, { status: 400 });
  }

  const fields = {
    status: body.status,
    checked_by: body.checked_by ?? null,
    notes: body.notes ?? null,
    corrective_action: body.corrective_action ?? null,
    recheck_required: body.recheck_required ?? false,
    temperature_c: body.temperature_c ?? null,
    humidity_percent: body.humidity_percent ?? null,
    ph_level: body.ph_level ?? null,
    water_activity: body.water_activity ?? null,
    checked_at: new Date().toISOString(),
  };

  // Check if a row already exists for this batch/checkpoint
  const { data: existingRows, error: selErr } = await supabase
    .from('batch_qa_checks')
    .select('id')
    .eq('batch_id', body.batch_id)
    .eq('checkpoint_id', body.checkpoint_id)
    .limit(1);

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 400 });
  }

  if (existingRows && existingRows.length > 0) {
    const id = existingRows[0].id as string;
    const { error: updErr } = await supabase
      .from('batch_qa_checks')
      .update(fields)
      .eq('id', id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }
  } else {
    const { error: insErr } = await supabase
      .from('batch_qa_checks')
      .insert([{ batch_id: body.batch_id, checkpoint_id: body.checkpoint_id, ...fields }]);

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}