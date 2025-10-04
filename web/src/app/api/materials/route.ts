// src/app/api/materials/route.ts
import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).transform(s => s.trim()),
  material_code: z.string().min(1).transform(s => s.trim().toUpperCase()),
  category: z.enum(['beef', 'spice', 'packaging', 'additive', 'cure', 'other']),
  unit: z.enum(['g', 'kg', 'ml', 'L', 'units']).default('g'),
  reorder_point: z.number().nonnegative().optional().nullable(),
  storage_conditions: z.string().optional().nullable(),
  shelf_life_days: z.number().int().nonnegative().optional().nullable(),
});

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('materials')
    .select('id, name, material_code, category, unit, is_active')
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ materials: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = createClient();

  let body: z.infer<typeof schema>;
  try {
    const raw = await request.json();
    body = schema.parse(raw);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 422 });
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('materials')
    .insert({
      name: body.name,
      material_code: body.material_code,
      category: body.category,
      unit: body.unit ?? 'g',
      reorder_point: body.reorder_point ?? null,
      storage_conditions: body.storage_conditions ?? null,
      shelf_life_days: body.shelf_life_days ?? null,
      // is_active defaults true in your schema
    })
    .select('id, name, material_code, category, unit, is_active')
    .single();

if (error) {
  // PostgrestError from supabase has a `code` we can read safely
  const msg = error.code === '23505'
    ? 'A material with this code already exists.'
    : error.message;
  return NextResponse.json({ error: msg }, { status: 400 });
}


  return NextResponse.json({ material: data }, { status: 201 });
}
