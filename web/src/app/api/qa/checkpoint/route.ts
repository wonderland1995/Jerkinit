// src/app/api/qa/checkpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type Status = 'pending'|'passed'|'failed'|'skipped'|'conditional';

interface PostBody {
  batch_id: string;
  checkpoint_id: string;
  status: Status;
  checked_by?: string | null;
  temperature_c?: number | null;
  humidity_percent?: number | null;
  ph_level?: number | null;
  water_activity?: number | null;
  notes?: string | null;
  corrective_action?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const body = (await req.json()) as PostBody;

  const { data, error } = await supabase
    .from('batch_qa_checks')
    .upsert(
      [{
        batch_id: body.batch_id,
        checkpoint_id: body.checkpoint_id,
        status: body.status,
        checked_by: body.checked_by ?? null,
        checked_at: new Date().toISOString(),
        temperature_c: body.temperature_c ?? null,
        humidity_percent: body.humidity_percent ?? null,
        ph_level: body.ph_level ?? null,
        water_activity: body.water_activity ?? null,
        notes: body.notes ?? null,
        corrective_action: body.corrective_action ?? null,
        metadata: body.metadata ?? {},
      }],
      { onConflict: 'batch_id,checkpoint_id' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ check: data });
}
