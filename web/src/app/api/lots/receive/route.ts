// src/app/api/lots/receive/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type Unit = 'g' | 'kg';

type BeefReceiveBody = {
  material_id: string;             // must be a beef material
  supplier_id: string | null;
  lot_number: string;
  internal_lot_code?: string | null;
  received_date: string;           // YYYY-MM-DD
  expiry_date?: string | null;     // YYYY-MM-DD | null
  quantity: number;                // in the selected unit (g or kg)
  unit: Unit;                      // 'g' or 'kg'
  unit_cost?: number | null;
  storage_location?: string | null;

  // simple QA on receipt
  receiving_temp_c: number;        // e.g. 2.7
  packaging_intact: boolean;
  odour_ok: boolean;
  visual_ok: boolean;
  notes?: string | null;
};

export async function POST(req: NextRequest) {
  const supabase = createClient();

  try {
    const body: BeefReceiveBody = await req.json();

    // basic validation
    if (!body.material_id || !body.lot_number || !body.received_date) {
      return NextResponse.json(
        { error: 'material_id, lot_number and received_date are required' },
        { status: 400 }
      );
    }

    // normalize to grams
    const qtyGrams = body.unit === 'kg' ? body.quantity * 1000 : body.quantity;
    if (qtyGrams <= 0) {
      return NextResponse.json({ error: 'quantity must be > 0' }, { status: 400 });
    }

    // auto internal code if not supplied
    const internalCode =
      body.internal_lot_code && body.internal_lot_code.trim().length > 0
        ? body.internal_lot_code.trim()
        : `BEEF-${new Date(body.received_date).toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
            .toString(36)
            .slice(2, 6)
            .toUpperCase()}`;

    // simple pass rule: temp <= 5, packaging ok, odour ok, visual ok
    const passedReceiving =
      body.receiving_temp_c <= 5 &&
      body.packaging_intact &&
      body.odour_ok &&
      body.visual_ok;

    const qaPayload = {
      receiving_temp_c: body.receiving_temp_c,
      packaging_intact: body.packaging_intact,
      odour_ok: body.odour_ok,
      visual_ok: body.visual_ok,
      notes: body.notes ?? null,
      check_time: new Date().toISOString(),
      check_rule: '≤5°C, packaging/odour/visual OK',
    };

    // insert lot
    const { data: lot, error: lotErr } = await supabase
      .from('lots')
      .insert({
        material_id: body.material_id,
        supplier_id: body.supplier_id,
        lot_number: body.lot_number,
        internal_lot_code: internalCode,
        received_date: body.received_date,
        expiry_date: body.expiry_date ?? null,
        quantity_received: qtyGrams,
        current_balance: qtyGrams,
        unit_cost: body.unit_cost ?? null,
        certificate_of_analysis: qaPayload, // reuse this JSONB to store receiving QA
        status: 'available',
        passed_receiving_qa: passedReceiving,
        storage_location: body.storage_location ?? null,
      })
      .select('id, internal_lot_code')
      .single();

    if (lotErr || !lot) {
      return NextResponse.json({ error: lotErr?.message ?? 'Failed to create lot' }, { status: 400 });
    }

    // create lot event (receive)
    const { error: evErr } = await supabase.from('lot_events').insert({
      lot_id: lot.id,
      event_type: 'receive',
      quantity: qtyGrams,
      balance_after: qtyGrams,
      reason: 'Beef receiving',
    });
    if (evErr) {
      // not fatal for UX, but return 207 to signal partial
      return NextResponse.json(
        { id: lot.id, internal_lot_code: lot.internal_lot_code, warning: 'Lot created, but event not recorded' },
        { status: 207 }
      );
    }

    return NextResponse.json({ id: lot.id, internal_lot_code: lot.internal_lot_code }, { status: 201 });
  } catch (err) {
    console.error('Beef receive error:', err);
    return NextResponse.json({ error: 'Failed to receive beef' }, { status: 500 });
  }
}
