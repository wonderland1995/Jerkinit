import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { AllocateLotsRequest, LotAllocation } from '@/types/inventory';

export async function POST(request: Request) {
  const supabase = createClient();
  const body: AllocateLotsRequest = await request.json();
  
  const { batch_id, material_id, quantity_needed } = body;
  
  // Get available lots in FIFO order
  const { data: lots, error: lotsError } = await supabase
    .rpc('get_available_lots_fifo', { p_material_id: material_id });
  
  if (lotsError || !lots) {
    return NextResponse.json(
      { error: 'Failed to fetch available lots' },
      { status: 500 }
    );
  }
  
  // Allocate across lots
  let remaining = quantity_needed;
  const allocations: LotAllocation[] = [];
  const usageRecords = [];
  const eventRecords = [];
  
  for (const lot of lots) {
    if (remaining <= 0) break;
    
    const toAllocate = Math.min(remaining, lot.current_balance);
    const newBalance = lot.current_balance - toAllocate;
    
    allocations.push({
      lot_id: lot.lot_id,
      lot_number: lot.lot_number,
      quantity_allocated: toAllocate,
      remaining_balance: newBalance,
    });
    
    usageRecords.push({
      batch_id,
      lot_id: lot.lot_id,
      material_id,
      quantity_used: toAllocate,
      unit: 'g',
    });
    
    eventRecords.push({
      lot_id: lot.lot_id,
      event_type: 'consume',
      quantity: -toAllocate,
      balance_after: newBalance,
      batch_id,
      reason: `Consumed in batch ${batch_id}`,
    });
    
    remaining -= toAllocate;
  }
  
  if (remaining > 0) {
    return NextResponse.json(
      { error: `Insufficient stock. Short by ${remaining}g` },
      { status: 400 }
    );
  }
  
  // Insert batch_lot_usage records
  const { error: usageError } = await supabase
    .from('batch_lot_usage')
    .insert(usageRecords);
  
  if (usageError) {
    return NextResponse.json({ error: usageError.message }, { status: 500 });
  }
  
  // Insert lot_events (trigger will update lot balances)
  const { error: eventError } = await supabase
    .from('lot_events')
    .insert(eventRecords);
  
  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }
  
  return NextResponse.json({ allocations });
}