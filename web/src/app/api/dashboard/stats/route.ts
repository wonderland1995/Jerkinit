import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient();

  try {
    // Existing batch stats
    const { data: batches } = await supabase
      .from('batches')
      .select('status');

    const batch_stats = {
      total_batches: batches?.length || 0,
in_progress: batches?.filter((b: { status: string }) => b.status === 'in_progress').length || 0,
completed: batches?.filter((b: { status: string }) => b.status === 'completed').length || 0,
      released: 0, // You'd calculate this from batch_releases if needed
    };

    // New inventory stats
    const { data: inventorySummary } = await supabase
      .rpc('get_material_inventory_summary');

    const low_stock_count = inventorySummary?.filter((item: { is_low_stock: boolean }) => item.is_low_stock).length || 0;
    
    // Expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const { data: expiringLots } = await supabase
      .from('lots')
      .select('expiry_date')
      .eq('status', 'available')
      .gte('expiry_date', new Date().toISOString().split('T')[0])
      .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0]);

    return NextResponse.json({
      ...batch_stats,
      inventory: {
        total_materials: inventorySummary?.length || 0,
        low_stock_count,
        expiring_soon_count: expiringLots?.length || 0,
        total_lot_value: 0,
        materials_by_category: {},
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}