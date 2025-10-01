import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { Material } from '@/types/inventory';

export async function GET() {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ materials: data as Material[] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const body = await request.json();
  
  const { data, error } = await supabase
    .from('materials')
    .insert({
      name: body.name,
      material_code: body.material_code,
      category: body.category,
      unit: body.unit || 'g',
      reorder_point: body.reorder_point,
      storage_conditions: body.storage_conditions,
      shelf_life_days: body.shelf_life_days,
    })
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  
  return NextResponse.json({ material: data }, { status: 201 });
}