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
      id, lot_number, internal_lot_code, current_balance, received_date, expiry_date,
      supplier:suppliers(name),
      material:materials(id, name, category, unit)
    `)
    .gt('current_balance', 0)
    .order('received_date', { ascending: true });

  const trimmed = q.trim();
  const sanitized = trimmed.replace(/[%_]/g, '');
  if (sanitized) {
    const like = `%${sanitized}%`;
    query = query.or(
      `lot_number.ilike.${like},internal_lot_code.ilike.${like}`
    );
  }
  if (materialId) {
    query = query.eq('material_id', materialId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Normalize Supabase nested relations (can return as arrays)
  let lots = (data ?? []).map((item) => {
    const supplier = Array.isArray(item.supplier) ? item.supplier[0] : item.supplier;
    const material = Array.isArray(item.material) ? item.material[0] : item.material;
    const unit = (material?.unit ?? 'kg') as LotListItem['unit'];
    return {
      ...item,
      unit,
      supplier,
      material,
    } as LotListItem;
  });

  if (category) {
    const normalized = category.toLowerCase();
    lots = lots.filter((lot) => lot.material?.category?.toLowerCase() === normalized);
  }

  if (sanitized) {
    const needle = sanitized.toLowerCase();
    lots = lots.filter((lot) => {
      const candidate = [
        lot.lot_number,
        lot.internal_lot_code,
        lot.material?.name,
      ]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());
      return candidate.some((value) => value.includes(needle));
    });
  }

  return NextResponse.json({ lots });
}
