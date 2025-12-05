import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type BatchStatus = 'in_progress' | 'completed' | 'cancelled' | 'released';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await context.params;
  const supabase = createClient();

  const { data: existing, error: fetchErr } = await supabase
    .from('batches')
    .select('id, status, release_status, release_number, completed_at')
    .eq('id', batchId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json(
      { error: fetchErr?.message ?? 'Batch not found' },
      { status: 404 }
    );
  }

  const targetStatus: BatchStatus = 'released';
  const completedAt =
    existing.completed_at && typeof existing.completed_at === 'string'
      ? existing.completed_at
      : new Date().toISOString();

  const attemptUpdate = (payload: Record<string, unknown>) =>
    supabase
      .from('batches')
      .update(payload)
      .eq('id', batchId)
      .select('id, status, release_status, release_number, completed_at')
      .single();

  let { data: updated, error: updErr } = await attemptUpdate({
    status: targetStatus,
    release_status: 'approved',
    completed_at: completedAt,
  });

  if (updErr) {
    const columnMissing = /\brelease_status\b/.test(updErr.message ?? '');
    if (columnMissing) {
      const fallback = await attemptUpdate({
        status: targetStatus,
        completed_at: completedAt,
      });
      updated = fallback.data;
      updErr = fallback.error;
    }
  }

  if (updErr || !updated) {
    return NextResponse.json(
      { error: updErr?.message ?? 'Failed to release batch' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: (updated.status as BatchStatus | null) ?? targetStatus,
    release_status: updated.release_status ?? 'approved',
    release_number: updated.release_number ?? null,
    completed_at: updated.completed_at ?? completedAt,
  });
}
