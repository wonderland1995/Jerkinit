
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET() {
  try {
    // Query the batch_compliance_summary view
    const { data: batches, error } = await supabase
      .from('batch_compliance_summary')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching batch history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch batch history' },
        { status: 500 }
      );
    }

    // Transform the data to match our interface
    const transformedBatches = batches?.map(batch => ({
      id: batch.batch_id,
      batch_id: batch.batch_number,
      product_name: batch.product_name,
      beef_weight_kg: 0, // You might need to join with batches table for this
      status: batch.batch_status,
      created_at: batch.created_at,
      completed_at: batch.completed_at,
      created_by: null, // You might need to join with batches table
      tolerance_compliance_percent: batch.tolerance_compliance_percent,
      qa_checkpoints_passed: batch.passed_checkpoints || 0,
      qa_checkpoints_total: batch.required_checkpoints || 0,
      documents_approved: batch.approved_documents || 0,
      documents_required: batch.required_documents || 0,
      release_status: batch.release_status,
      release_number: batch.release_number
    })) || [];

    // If the view doesn't exist, fall back to direct query
    if (transformedBatches.length === 0) {
      const { data: directBatches, error: directError } = await supabase
        .from('batches')
        .select(`
          *,
          products (name),
          batch_releases (release_status, release_number)
        `)
        .order('created_at', { ascending: false });

      if (directError) {
        console.error('Direct query error:', directError);
      } else if (directBatches) {
        const formattedBatches = directBatches.map(batch => ({
          id: batch.id,
          batch_id: batch.batch_id,
          product_name: batch.products?.name || 'Unknown',
          beef_weight_kg: batch.beef_weight_kg,
          status: batch.status,
          created_at: batch.created_at,
          completed_at: batch.completed_at,
          created_by: batch.created_by,
          tolerance_compliance_percent: null,
          qa_checkpoints_passed: 0,
          qa_checkpoints_total: 0,
          documents_approved: 0,
          documents_required: 0,
          release_status: batch.batch_releases?.release_status || null,
          release_number: batch.batch_releases?.release_number || null
        }));

        return NextResponse.json({ batches: formattedBatches });
      }
    }

    return NextResponse.json({ batches: transformedBatches });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}