// src/app/api/lots/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type LotListItem = {
  id: string;
  lot_number: string;
  internal_lot_code: string;
  current_balance: number;
  unit: 'g' | 'kg' | 'ml' | 'L' | 'units';
  received_date: string | null;
  expiry_date: string | null;
  supplier: { name: string } | null;
  material: { id: string; name: string; category: string; unit: LotListItem['unit'] } | null;
};

export async function GET(req: NextRequest) {
  const supabase = createClient();

  const q = req.nextUrl.searchParams.get('q') ?? '';
  const category = req.nextUrl.searchParams.get('category'); // e.g. 'beef'
  const materialId = req.nextUrl.searchParams.get('material_id');

  // Base query with useful joins
  let query = supabase
    .from('lots')
    .select(`
      id, lot_number, internal_lot_code, current_balance, unit, received_date, expiry_date,
      supplier:suppliers(name),
      material:materials(id, name, category, unit)
    `)
    .gt('current_balance', 0)
    .order('received_date', { ascending: true });

  if (q) {
    query = query.ilike('lot_number', `%${q}%`);
  }
  if (category) {
    // filter through joined material
    query = query.eq('material.category', category);
  }
  if (materialId) {
    query = query.eq('material_id', materialId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Normalize Supabase nested relations (can return as arrays)
  const lots = (data ?? []).map(item => ({
    ...item,
    supplier: Array.isArray(item.supplier) ? item.supplier[0] : item.supplier,
    material: Array.isArray(item.material) ? item.material[0] : item.material,
  })) as LotListItem[];
  
  return NextResponse.json({ lots });
}