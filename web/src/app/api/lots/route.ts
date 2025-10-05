// src/app/api/lots/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

type LotRow = {
  id: string;
  material_id: string;
  lot_number: string;
  internal_lot_code: string;
  received_date: string | null;
  expiry_date: string | null;
  quantity_received: number;
  current_balance: number;
  supplier: { name: string | null } | null;
  material: { id: string; unit: Unit; name: string } | null;
};

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  const material_id = searchParams.get('material_id');
  const q = (searchParams.get('q') || '').trim();

  if (!material_id) {
    return NextResponse.json({ error: 'material_id is required' }, { status: 400 });
  }

  // available lots for the material, with positive balance
  let query = supabase
    .from('lots')
    .select(`
      id, material_id, lot_number, internal_lot_code, received_date, expiry_date,
      quantity_received, current_balance,
      supplier:suppliers ( name ),
      material:materials ( id, name, unit )
    `)
    .eq('material_id', material_id)
    .eq('status', 'available')
    .gt('current_balance', 0)
    .order('received_date', { ascending: true });

  if (q) {
    // simple search over lot_number / internal code
    query = query.or(`lot_number.ilike.%${q}%,internal_lot_code.ilike.%${q}%`);
  }

  const { data, error } = await query.returns<LotRow[]>();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ lots: data ?? [] });
}
