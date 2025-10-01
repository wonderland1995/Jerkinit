import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lotID: string }> }
) {
  const { lotID } = await params;
  const supabase = createClient();

  const { data, error } = await supabase
    .from('batch_lot_usage')
    .select(`
      *,
      batch:batches(
        *,
        recipe:recipes(name, recipe_code)
      )
    `)
    .eq('lot_id', lotID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ affected_batches: data || [] });
}