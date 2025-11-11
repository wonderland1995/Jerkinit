import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type BatchStatus = 'in_progress' | 'completed' | 'cancelled' | 'released';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await context.params;
  const supabase = createClient();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const reasonRaw =
    typeof (body as { reason?: unknown })?.reason === 'string'
      ? (body as { reason: string }).reason.trim()
      : '';
  const notesRaw =
    typeof (body as { notes?: unknown })?.notes === 'string'
      ? (body as { notes: string }).notes.trim()
      : '';

  if (!reasonRaw) {
    return NextResponse.json({ error: 'Recall reason is required' }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('batches')
    .select('status, release_status')
    .eq('id', batchId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json(
      { error: fetchErr?.message ?? 'Batch not found' },
      { status: 404 }
    );
  }

  const derivedStatus: BatchStatus =
    (existing.status as BatchStatus | null) === 'released'
      ? 'completed'
      : ((existing.status as BatchStatus | null) ?? 'completed');

  const attemptUpdate = (payload: Record<string, unknown>) =>
    supabase
      .from('batches')
      .update(payload)
      .eq('id', batchId)
      .select('id, status, release_status, recall_reason')
      .single();

  const basePayload: Record<string, unknown> = {
    status: derivedStatus,
    release_status: 'recalled',
    recall_reason: reasonRaw,
  };

  if (notesRaw) {
    basePayload.recall_notes = notesRaw;
  } else {
    basePayload.recall_notes = null;
  }

  let { data: updated, error: updErr } = await attemptUpdate(basePayload);

  if (updErr) {
    const columnMissing = /\brecall_(?:reason|notes)\b/.test(updErr.message ?? '');
    if (columnMissing) {
      const fallbackPayload = {
        status: derivedStatus,
        release_status: 'recalled',
      };
      const fallback = await attemptUpdate(fallbackPayload);
      updated = fallback.data;
      updErr = fallback.error;
    }
  }

  if (updErr || !updated) {
    return NextResponse.json(
      { error: updErr?.message ?? 'Failed to mark batch as recalled' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    release_status: updated.release_status ?? 'recalled',
  });
}
