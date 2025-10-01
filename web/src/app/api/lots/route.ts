import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  
  const materialId = searchParams.get('material_id');
  const status = searchParams.get('status');
  
  let query = supabase
    .from('lots')
    .select(`
      *,
      material:materials(*),
      supplier:suppliers(*)
    `)
    .order('received_date', { ascending: false });
  
  if (materialId) {
    query = query.eq('material_id', materialId);
  }
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data, error } = await query;
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ lots: data });
}