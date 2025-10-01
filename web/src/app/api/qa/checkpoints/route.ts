import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('qa_checkpoints')
    .select('*')
    .eq('active', true)
    .order('stage')
    .order('display_order');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ checkpoints: data });
}