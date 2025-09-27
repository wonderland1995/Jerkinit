import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';


export async function POST(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const body = await request.json();
    const { completed_by } = body;
    
    // Call the complete_batch_with_qa function
    const { data, error } = await supabase
      .rpc('complete_batch_with_qa', {
        p_batch_id: params.batchId,
        p_completed_by: completed_by || null
      });
    
    if (error) {
      console.error('Error completing batch:', error);
      return NextResponse.json(
        { error: 'Failed to complete batch', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data[0]);
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to complete batch' },
      { status: 500 }
    );
  }
}