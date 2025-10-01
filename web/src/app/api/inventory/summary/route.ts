import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient();

  const { data: materials, error } = await supabase
    .from('materials')
    .select(`
      *,
      lots(id, current_balance, received_date, expiry_date, status)
    `)
    .eq('is_active', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const inventory = materials.map((material: { lots: { id: string; current_balance: number; received_date: string | null; expiry_date: string | null; status: string }[]; id: string; name: string; material_code: string | null; category: string | null; unit: string; reorder_point: number | null; }) => {
    const availableLots = material.lots.filter((l: { id: string; current_balance: number; received_date: string | null; expiry_date: string | null; status: string }) => l.status === 'available');
    const total_on_hand = availableLots.reduce((sum: number, lot: { id: string; current_balance: number; received_date: string | null; expiry_date: string | null; status: string }) => sum + lot.current_balance, 0);
    
    const dates = availableLots
      .filter((l: { id: string; current_balance: number; received_date: string | null; expiry_date: string | null; status: string }) => l.expiry_date)
      .map((l: { id: string; current_balance: number; received_date: string | null; expiry_date: string | null; status: string }) => new Date(l.expiry_date).getTime());
    
    const nearest_expiry_date = dates.length > 0 
      ? new Date(Math.min(...dates)).toISOString().split('T')[0]
      : null;

    const oldest_lot_date = availableLots.length > 0
      ? availableLots.reduce((oldest: string, lot: { id: string; current_balance: number; received_date: string | null; expiry_date: string | null; status: string }) => 
          lot.received_date < oldest ? lot.received_date : oldest,
          availableLots[0].received_date
        )
      : null;

    const is_low_stock = material.reorder_point ? total_on_hand < material.reorder_point : false;

    return {
      material: {
        id: material.id,
        name: material.name,
        material_code: material.material_code,
        category: material.category,
        unit: material.unit,
        reorder_point: material.reorder_point,
      },
      total_on_hand,
      lot_count: availableLots.length,
      oldest_lot_date,
      nearest_expiry_date,
      is_low_stock,
    };
  });

  return NextResponse.json({ inventory });
}