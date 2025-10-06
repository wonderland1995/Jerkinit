// src/app/api/batches/[batchId]/beef/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type Unit = 'g' | 'kg';

type BeefAllocationInput = {
  lot_id: string;
  quantity: number; // user-entered amount
  unit: Unit;       // 'g' or 'kg'
};

type BeefAllocationRow = {
  id: string;
  batch_id: string;
  lot_id: string;
  material_id: string;
  quantity_used: number; // stored in grams for consistency
  unit: string;          // keep original unit too (schema requires)
  allocated_at: string;
  lot: {
    id: string;
    lot_number: string;
    internal_lot_code: string;
    current_balance: number;
    received_date: string | null;
    expiry_date: string | null;
    supplier: { name: string } | null;
  } | null;
};

// Normalize to grams (numbers are small so float is OK for UI;
// we still store numeric in DB).
function toGrams(quantity: number, unit: Unit): number {
  return unit === 'kg' ? quantity * 1000 : quantity;
}

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ batchId: string }> }
) {
  const params = await props.params;
  const { batchId } = params;
  const supabase = createClient();

  // Get all beef material ids
  const { data: beefMaterials, error: mErr } = await supabase
    .from('materials')
    .select('id')
    .eq('category', 'beef');

  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const beefIds = (beefMaterials ?? []).map((m) => m.id);
  if (beefIds.length === 0) {
    return NextResponse.json({ allocations: [], total_g: 0 });
  }

  // Pull allocations for those materials for this batch
  const { data, error } = await supabase
    .from('batch_lot_usage')
    .select(`
      id, batch_id, lot_id, material_id, quantity_used, unit, allocated_at,
      lot:lots (
        id, lot_number, internal_lot_code, current_balance, received_date, expiry_date,
        supplier:suppliers(name)
      )
    `)
    .eq('batch_id', batchId)
    .in('material_id', beefIds)
    .order('allocated_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allocations = (data ?? []).map(item => {
    const lot = Array.isArray(item.lot) ? item.lot[0] : item.lot;
    return {
      ...item,
      lot: lot ? {
        ...lot,
        supplier: Array.isArray(lot.supplier) ? lot.supplier[0] : lot.supplier,
      } : null,
    };
  }) as BeefAllocationRow[];
  const total_g = allocations.reduce((sum, a) => sum + Number(a.quantity_used || 0), 0);

  return NextResponse.json({ allocations, total_g });
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ batchId: string }> }
) {
  const params = await props.params;
  const { batchId } = params;
  const supabase = createClient();

  const body = (await req.json()) as BeefAllocationInput;

  if (!body.lot_id || !body.quantity || body.quantity <= 0) {
    return NextResponse.json({ error: 'lot_id and positive quantity are required' }, { status: 400 });
  }
  const unit: Unit = body.unit === 'kg' ? 'kg' : 'g';
  const qty_g = toGrams(body.quantity, unit);

  // Validate the lot is a beef lot and has enough balance
  const { data: lotRows, error: lotErr } = await supabase
    .from('lots')
    .select(`
      id, material_id, lot_number, internal_lot_code, current_balance, unit,
      material:materials(id, category)
    `)
    .eq('id', body.lot_id)
    .limit(1);

  if (lotErr) return NextResponse.json({ error: lotErr.message }, { status: 500 });
  const lotData = lotRows?.[0];
  if (!lotData) return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
  
  // Handle material being an array or single object - Supabase can return relations as arrays
  const materialData = lotData.material;
  const material = Array.isArray(materialData) ? materialData[0] : materialData;
  if (!material || !('category' in material) || material.category !== 'beef') {
    return NextResponse.json({ error: 'Selected lot is not beef' }, { status: 400 });
  }
  
  // Now use lotData as lot for the rest of the function
  const lot = lotData;

  // We expect lot.unit to be 'g' or 'kg'; normalize current_balance to grams for comparison
  const lotUnit = (lot.unit === 'kg' ? 'kg' : 'g') as Unit;
  const lotBalance_g = toGrams(Number(lot.current_balance || 0), lotUnit);

  if (lotBalance_g < qty_g) {
    return NextResponse.json({ error: 'Insufficient lot balance' }, { status: 400 });
  }

  // 1) Insert usage
  const { data: usage, error: uErr } = await supabase
    .from('batch_lot_usage')
    .insert({
      batch_id: batchId,
      lot_id: lot.id,
      material_id: lot.material_id,
      quantity_used: qty_g,  // store as grams for consistency
      unit: 'g',
    })
    .select('id')
    .single();

  if (uErr || !usage) {
    return NextResponse.json({ error: uErr?.message ?? 'Failed to insert usage' }, { status: 500 });
  }

  // 2) Add lot event (consume)
  const { error: eErr } = await supabase
    .from('lot_events')
    .insert({
      lot_id: lot.id,
      event_type: 'consume',
      quantity: qty_g,        // grams
      balance_after: lotBalance_g - qty_g,
      batch_id: batchId,
      reason: 'Beef allocation to batch',
    });

  if (eErr) {
    // Best effort rollback usage
    await supabase.from('batch_lot_usage').delete().eq('id', usage.id);
    return NextResponse.json({ error: eErr.message }, { status: 500 });
  }

  // 3) Update lot balance
  const newBalance_g = lotBalance_g - qty_g;
  const newBalanceDisplay =
    lotUnit === 'kg' ? newBalance_g / 1000 : newBalance_g;

  const { error: bErr } = await supabase
    .from('lots')
    .update({ current_balance: newBalanceDisplay })
    .eq('id', lot.id);

  if (bErr) {
    // Best effort rollback
    await supabase.from('lot_events').delete().eq('lot_id', lot.id).eq('batch_id', batchId).eq('event_type', 'consume');
    await supabase.from('batch_lot_usage').delete().eq('id', usage.id);
    return NextResponse.json({ error: bErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}