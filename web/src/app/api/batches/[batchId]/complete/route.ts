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

  // Mark as released
  const { data: updated, error: updErr } = await supabase
    .from('batches')
    .update({
      status: 'released',
      release_status: 'approved',
      completed_at: new Date().toISOString(),
    })
    .eq('id', batchId)
    .select('status')
    .single();

  if (updErr || !updated) {
    return NextResponse.json(
      { error: updErr?.message ?? 'Failed to complete batch' },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, status: updated.status as BatchStatus });
}
