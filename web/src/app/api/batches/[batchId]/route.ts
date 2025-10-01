import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const supabase = createClient();

  const { data, error } = await supabase
    .from('batches')
    .select(`
      *,
      product:products(*),
      recipe:recipes(*),
      ingredients:batch_ingredients(
        *,
        material:materials(*)
      )
    `)
    .eq('id', batchId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ batch: data });
}