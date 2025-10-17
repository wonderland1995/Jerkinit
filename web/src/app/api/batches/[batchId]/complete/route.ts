import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type BatchStatus = 'in_progress' | 'completed' | 'cancelled' | 'released';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await context.params;
  const supabase = createClient();

  // Ensure the batch exists
  const { data: existing, error: fetchErr } = await supabase
    .from('batches')
    .select('status')
    .eq('id', batchId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json(
      { error: fetchErr?.message ?? 'Batch not found' },
      { status: 404 }
    );
  }

  // If already released, just return ok
  if (existing.status === 'released') {
    return NextResponse.json({ ok: true, status: 'released' as BatchStatus });
  }

  const now = new Date().toISOString();

  const attemptUpdate = async (payload: Record<string, unknown>) => {
    return supabase
      .from('batches')
      .update(payload)
      .eq('id', batchId)
      .select('status')
      .single();
  };

  // Try updating release-specific fields (if column exists). If that fails,
  // fall back to only setting the status so we don't break installations
  // without release-specific columns.
  let { data: updated, error: updErr } = await attemptUpdate({
    status: 'released',
    release_status: 'approved',
    completed_at: now,
  });

  if (updErr) {
    const columnMissing = /\brelease_status\b/.test(updErr.message ?? '');
    if (columnMissing) {
      const fallback = await attemptUpdate({
        status: 'released',
        completed_at: now,
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

  return NextResponse.json({ ok: true, status: updated.status as BatchStatus });
}
