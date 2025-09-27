import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { BatchQADataResponse } from '@/types/qa';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const batchId = params.batchId;
    
    // Fetch batch with product info
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select(`
        *,
        products (name)
      `)
      .eq('id', batchId)
      .single();
    
    if (batchError || !batch) {
      return NextResponse.json(
        { error: 'Batch not found' },
        { status: 404 }
      );
    }
    
    // Fetch ingredients with tolerance status
    const { data: ingredients } = await supabase
      .from('batch_ingredients')
      .select('*')
      .eq('batch_id', batchId)
      .order('ingredient_name');
    
    // Fetch checkpoints with their checks
    const { data: checkpoints } = await supabase
      .from('qa_checkpoints')
      .select(`
        *,
        batch_qa_checks!left (*)
      `)
      .eq('active', true)
      .eq('batch_qa_checks.batch_id', batchId)
      .order('display_order');
    
    // Fetch documents with types
    const { data: documentTypes } = await supabase
      .from('qa_document_types')
      .select('*')
      .eq('required_for_batch', true)
      .eq('active', true);
    
    const { data: documents } = await supabase
      .from('qa_documents')
      .select(`
        *,
        qa_document_types (name)
      `)
      .eq('batch_id', batchId);
    
    // Fetch release info
    const { data: release } = await supabase
      .from('batch_releases')
      .select('*')
      .eq('batch_id', batchId)
      .single();
    
    // Calculate compliance
    const toleranceCompliance = ingredients
      ? Math.round(
          (ingredients.filter(i => i.in_tolerance === true).length / 
           ingredients.filter(i => i.actual_amount !== null).length) * 100
        ) || 0
      : 0;
    
    // Format response
    const response: BatchQADataResponse = {
      batch: {
        ...batch,
        product_name: batch.products.name,
        tolerance_compliance: toleranceCompliance
      },
      ingredients: ingredients || [],
      checkpoints: checkpoints?.map(cp => ({
        ...cp,
        check: cp.batch_qa_checks?.[0] || undefined
      })) || [],
      documents: documents?.map(doc => ({
        ...doc,
        document_type_name: doc.qa_document_types?.name || 'Unknown'
      })) || [],
      release: release || undefined
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error fetching batch QA data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch QA data' },
      { status: 500 }
    );
  }
}
