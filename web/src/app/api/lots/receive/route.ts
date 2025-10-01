import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { ReceiveLotRequest } from '@/types/inventory';

export async function POST(request: Request) {
  const supabase = createClient();
  const body: ReceiveLotRequest = await request.json();
  
  // Generate internal lot code
  const timestamp = Date.now().toString(36).toUpperCase();
  const internal_lot_code = `LOT-${timestamp}`;
  
  // Start transaction (insert lot + create receive event)
  const { data: lot, error: lotError } = await supabase
    .from('lots')
    .insert({
      material_id: body.material_id,
      supplier_id: body.supplier_id,
      lot_number: body.lot_number,
      internal_lot_code,
      received_date: body.received_date,
      expiry_date: body.expiry_date,
      quantity_received: body.quantity_received,
      current_balance: body.quantity_received,
      unit_cost: body.unit_cost,
      certificate_of_analysis_url: body.certificate_of_analysis_url,
      status: 'available',
      notes: body.notes,
    })
    .select()
    .single();
  
  if (lotError) {
    return NextResponse.json({ error: lotError.message }, { status: 400 });
  }
  
  // Create receive event
  const { error: eventError } = await supabase
    .from('lot_events')
    .insert({
      lot_id: lot.id,
      event_type: 'receive',
      quantity: body.quantity_received,
      balance_after: body.quantity_received,
      reason: 'Initial receipt',
    });
  
  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }
  
  return NextResponse.json({ lot }, { status: 201 });
}