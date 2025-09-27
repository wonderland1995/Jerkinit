// src/app/api/qa/batch/[batchId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import type { BatchQADataResponse } from '@/types/qa';

// Next 15 typed routes: params is a Promise
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
): Promise<NextResponse<BatchQADataResponse> | NextResponse<{ error: string }>> {
  try {
    const { batchId } = await context.params;

    // 1) Batch + product
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select(`
        *,
        products ( name )
      `)
      .eq('id', batchId)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // 2) Ingredients
    const { data: ingredients, error: ingredientsError } = await supabase
      .from('batch_ingredients')
      .select('*')
      .eq('batch_id', batchId)
      .order('ingredient_name', { ascending: true });

    if (ingredientsError) {
      return NextResponse.json({ error: ingredientsError.message }, { status: 500 });
    }

    // 3) Checkpoints with left-joined checks for this batch
    const { data: checkpoints, error: checkpointsError } = await supabase
      .from('qa_checkpoints')
      .select(`
        *,
        batch_qa_checks!left(*)
      `)
      .eq('active', true)
      .eq('batch_qa_checks.batch_id', batchId)
      .order('display_order', { ascending: true });

    if (checkpointsError) {
      return NextResponse.json({ error: checkpointsError.message }, { status: 500 });
    }

    // 4) Document types (required for batch)
    const { data: documentTypes, error: docTypesError } = await supabase
      .from('qa_document_types')
      .select('*')
      .eq('required_for_batch', true)
      .eq('active', true);

    if (docTypesError) {
      return NextResponse.json({ error: docTypesError.message }, { status: 500 });
    }

    // 5) Documents for this batch (with type name)
    const { data: documents, error: documentsError } = await supabase
      .from('qa_documents')
      .select(`
        *,
        qa_document_types ( name )
      `)
      .eq('batch_id', batchId);

    if (documentsError) {
      return NextResponse.json({ error: documentsError.message }, { status: 500 });
    }

    // 6) Release (if any)
    const { data: release, error: releaseError } = await supabase
      .from('batch_releases')
      .select('*')
      .eq('batch_id', batchId)
      .maybeSingle();

    if (releaseError) {
      return NextResponse.json({ error: releaseError.message }, { status: 500 });
    }

    // 7) Compliance calc
    type Ingredient = { in_tolerance: boolean | null; actual_amount: number | null; ingredient_name: string };
    const ingArr: Ingredient[] = (ingredients ?? []) as Ingredient[];
    const measuredCount = ingArr.filter(i => i.actual_amount !== null).length;
    const inTolCount = ingArr.filter(i => i.in_tolerance === true).length;
    const toleranceCompliance = measuredCount > 0 ? Math.round((inTolCount / measuredCount) * 100) : 0;

    // 8) Build response
    const response: BatchQADataResponse = {
      batch: {
        ...(batch as any),
        product_name: (batch as any)?.products?.name ?? '',
        tolerance_compliance: toleranceCompliance,
      },
      ingredients: (ingredients as any[]) ?? [],
      checkpoints:
        (checkpoints as any[])?.map(cp => ({
          ...cp,
          check: Array.isArray(cp?.batch_qa_checks) ? cp.batch_qa_checks[0] : undefined,
        })) ?? [],
      documents:
        (documents as any[])?.map(doc => ({
          ...doc,
          document_type_name: (doc as any)?.qa_document_types?.name ?? 'Unknown',
        })) ?? [],
      // documentTypes included only if you plan to display; otherwise you can omit
      // raw_materials / testing omitted here; add if you query them
      release: (release as any) ?? undefined,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('Error fetching batch QA data:', err);
    return NextResponse.json({ error: 'Failed to fetch QA data' }, { status: 500 });
  }
}
