import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

function isMissingColumnError(error: { message?: string } | null, column: string) {
  return Boolean(error?.message && error.message.includes(column));
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ lotID: string }> }
) {
  const { lotID } = await context.params;
  const supabase = createClient();

  let body: { reason?: unknown; notes?: unknown; initiated_by?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const initiatedBy = typeof body.initiated_by === 'string' ? body.initiated_by.trim() : null;

  if (!reason) {
    return NextResponse.json({ error: 'Recall reason is required' }, { status: 400 });
  }

  const { data: lot, error: lotErr } = await supabase
    .from('lots')
    .select('id, lot_number, status')
    .eq('id', lotID)
    .single();

  if (lotErr || !lot) {
    return NextResponse.json({ error: lotErr?.message ?? 'Lot not found' }, { status: 404 });
  }

  const now = new Date().toISOString();

  const { data: usageRows, error: usageErr } = await supabase
    .from('batch_lot_usage')
    .select('batch_id')
    .eq('lot_id', lotID);

  if (usageErr) {
    return NextResponse.json({ error: usageErr.message }, { status: 400 });
  }

  const batchIds = Array.from(
    new Set(
      (usageRows ?? [])
        .map((row) => row.batch_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );

  const { data: recallRecord, error: recallErr } = await supabase
    .from('lot_recalls')
    .insert({
      lot_id: lotID,
      reason,
      notes: notes || null,
      initiated_by: initiatedBy,
    })
    .select('id')
    .single();

  if (recallErr || !recallRecord) {
    return NextResponse.json({ error: recallErr?.message ?? 'Failed to save recall' }, { status: 400 });
  }

  await supabase
    .from('lots')
    .update({
      status: 'recalled',
      recall_reason: reason,
      recall_notes: notes || null,
      recall_initiated_at: now,
      recall_initiated_by: initiatedBy,
    })
    .eq('id', lotID);

  if (batchIds.length > 0) {
    const rows = batchIds.map((id) => ({
      lot_recall_id: recallRecord.id,
      batch_id: id,
    }));
    await supabase.from('lot_recall_batches').upsert(rows, { onConflict: 'lot_recall_id,batch_id' });

    const batchUpdatePayload: Record<string, unknown> = {
      release_status: 'recalled',
      recall_reason: reason,
      recall_notes: notes || null,
      recalled_at: now,
    };

    let { error: batchErr } = await supabase.from('batches').update(batchUpdatePayload).in('id', batchIds);

    if (batchErr && (isMissingColumnError(batchErr, 'release_status') || isMissingColumnError(batchErr, 'recall_reason'))) {
      const fallbackPayload = { recalled_at: now };
      batchErr = (await supabase.from('batches').update(fallbackPayload).in('id', batchIds)).error;
    }

    if (batchErr) {
      return NextResponse.json({ error: batchErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    ok: true,
    recall_id: recallRecord.id,
    affected_batches: batchIds.length,
  });
}
