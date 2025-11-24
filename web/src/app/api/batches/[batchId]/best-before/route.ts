import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type Params = { params: Promise<{ batchId: string }> };

export async function PATCH(request: NextRequest, ctx: Params) {
  const { batchId } = await ctx.params;
  const supabase = createClient();

  let body: { best_before_date?: string | null } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const raw = body.best_before_date ?? null;
  let bestBeforeDate: string | null = null;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }
    bestBeforeDate = parsed.toISOString().slice(0, 10);
  }

  const { data, error } = await supabase
    .from('batches')
    .update({ best_before_date: bestBeforeDate })
    .eq('id', batchId)
    .select('id, best_before_date')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ best_before_date: data?.best_before_date ?? bestBeforeDate });
}
