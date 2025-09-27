import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      batch_id,
      checkpoint_id,
      status,
      notes,
      checked_by,
      temperature_c,
      humidity_percent,
      ph_level,
      water_activity,
      corrective_action
    } = body;
    
    // Upsert the QA check
    const { data, error } = await supabase
      .from('batch_qa_checks')
      .upsert({
        batch_id,
        checkpoint_id,
        status,
        notes,
        checked_by,
        checked_at: new Date().toISOString(),
        temperature_c,
        humidity_percent,
        ph_level,
        water_activity,
        corrective_action,
        recheck_required: status === 'failed'
      }, {
        onConflict: 'batch_id,checkpoint_id'
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error updating checkpoint:', error);
      return NextResponse.json(
        { error: 'Failed to update checkpoint' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to update checkpoint' },
      { status: 500 }
    );
  }
}
