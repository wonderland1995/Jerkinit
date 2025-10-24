import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ lotID: string }> }
) {
  const { lotID } = await context.params;
  if (!lotID) {
    return NextResponse.json({ error: 'lotID is required' }, { status: 400 });
  }

  const supabase = createClient();

  try {
    const { error: usageError } = await supabase.from('batch_lot_usage').delete().eq('lot_id', lotID);
    if (usageError) {
      return NextResponse.json({ error: usageError.message }, { status: 400 });
    }

    const { error: eventsError } = await supabase.from('lot_events').delete().eq('lot_id', lotID);
    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 400 });
    }

    const { error: lotError } = await supabase.from('lots').delete().eq('id', lotID);
    if (lotError) {
      return NextResponse.json({ error: lotError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Delete lot error:', error);
    return NextResponse.json({ error: 'Failed to delete lot' }, { status: 500 });
  }
}
