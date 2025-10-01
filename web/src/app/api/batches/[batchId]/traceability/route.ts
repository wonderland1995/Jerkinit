import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const supabase = createClient();

  const { data, error } = await supabase
    .from('batch_lot_usage')
    .select(`
      *,
      lot:lots(
        *,
        material:materials(*),
        supplier:suppliers(*)
      )
    `)
    .eq('batch_id', batchId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ traceability: data || [] });
}