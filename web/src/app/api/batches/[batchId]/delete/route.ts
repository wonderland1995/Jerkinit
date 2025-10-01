import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const supabase = createClient();

  try {
    // Get batch info first for logging
    const { data: batch } = await supabase
      .from('batches')
      .select('batch_id, product_id')
      .eq('id', batchId)
      .single();

    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Delete related records first (due to foreign key constraints)
    // Note: Some tables may have CASCADE delete, but we'll be explicit
    await Promise.all([
      supabase.from('batch_qa_checks').delete().eq('batch_id', batchId),
      supabase.from('batch_ingredients').delete().eq('batch_id', batchId),
      supabase.from('batch_lot_usage').delete().eq('batch_id', batchId),
      supabase.from('lot_events').delete().eq('batch_id', batchId),
      supabase.from('product_testing').delete().eq('batch_id', batchId),
      supabase.from('qa_documents').delete().eq('batch_id', batchId),
      supabase.from('batch_releases').delete().eq('batch_id', batchId),
    ]);

    // Finally delete the batch
    const { error: deleteError } = await supabase
      .from('batches')
      .delete()
      .eq('id', batchId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Batch ${batch.batch_id} deleted successfully` 
    });

  } catch (error) {
    console.error('Delete batch error:', error);
    return NextResponse.json(
      { error: 'Failed to delete batch' },
      { status: 500 }
    );
  }
}