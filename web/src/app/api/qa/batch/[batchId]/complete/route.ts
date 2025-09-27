// src/app/api/qa/batch/[batchId]/complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ batchId: string }> }   // ← Promise here
) {
  try {
    const { batchId } = await context.params;         // ← and await it
    const body = await request.json().catch(() => ({} as { completed_by?: string }));
    const completed_by = body?.completed_by ?? null;

    const { data, error } = await supabase.rpc('complete_batch_with_qa', {
      p_batch_id: batchId,
      p_completed_by: completed_by,
    });

    if (error) {
      console.error('Error completing batch:', error);
      return NextResponse.json(
        { error: 'Failed to complete batch', details: error.message },
        { status: 500 }
      );
    }

    // RPCs often return an array or scalar; normalize to something predictable
    return NextResponse.json({ ok: true, result: data ?? null });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: 'Failed to complete batch' }, { status: 500 });
  }
}
