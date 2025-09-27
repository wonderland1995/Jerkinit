// src/app/api/qa/batch/[batchId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';
import type {
  BatchQADataResponse,
  QACheckpoint,
  BatchQACheck,
  QADocument,
  BatchRelease,
} from '@/types/qa';
import type { BatchIngredient } from '@/types/database';

// ---- Local helper types for joined shapes ----
type JoinedBatch = {
  // include the fields you actually read elsewhere; '*' will bring more from DB
  id: string;
  created_at: string;
  status: string;
  // joined product name
  products: { name: string } | null;
};

// We’ll return checkpoints with an OPTIONAL inline 'check'
type CheckpointWithChecks = QACheckpoint & {
  batch_qa_checks?: BatchQACheck[] | null;
};

type DocumentWithType = QADocument & {
  qa_document_types?: { name: string } | null;
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
): Promise<NextResponse<BatchQADataResponse> | NextResponse<{ error: string }>> {
  try {
    const { batchId } = await context.params;

    // 1) Batch + product name
    // IMPORTANT: type the .single<T>() directly (don't chain .returns() after .single())
    const { data: batch, error: batchError } = await supabase
      .from('batches')
      .select(
        `
        *,
        products ( name )
      `
      )
      .eq('id', batchId)
      .single<JoinedBatch>();

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // 2) Ingredients (match your BatchIngredient shape)
    const { data: ingredients, error: ingredientsError } = await supabase
      .from('batch_ingredients')
      .select('*')
      .eq('batch_id', batchId)
      .order('ingredient_name', { ascending: true })
      .returns<BatchIngredient[]>();

    if (ingredientsError) {
      return NextResponse.json({ error: ingredientsError.message }, { status: 500 });
    }

    // 3) Checkpoints + checks (left-join filtered by this batch)
    const { data: checkpoints, error: checkpointsError } = await supabase
      .from('qa_checkpoints')
      .select(
        `
        *,
        batch_qa_checks!left(*)
      `
      )
      .eq('active', true)
      .eq('batch_qa_checks.batch_id', batchId)
      .order('display_order', { ascending: true })
      .returns<CheckpointWithChecks[]>();

    if (checkpointsError) {
      return NextResponse.json({ error: checkpointsError.message }, { status: 500 });
    }

    // 4) Documents with type name (include metadata/expires_at which exist on QADocument)
    const { data: documents, error: documentsError } = await supabase
      .from('qa_documents')
      .select(
        `
        *,
        qa_document_types ( name )
      `
      )
      .eq('batch_id', batchId)
      .returns<DocumentWithType[]>();

    if (documentsError) {
      return NextResponse.json({ error: documentsError.message }, { status: 500 });
    }

    // 5) Release (optional)
    const { data: release, error: releaseError } = await supabase
      .from('batch_releases')
      .select('*')
      .eq('batch_id', batchId)
      .maybeSingle<BatchRelease>();

    if (releaseError) {
      return NextResponse.json({ error: releaseError.message }, { status: 500 });
    }

    // 6) Compliance calculation
    const measuredCount = (ingredients ?? []).filter((i) => i.actual_amount !== null).length;
    const inTolCount = (ingredients ?? []).filter((i) => i.in_tolerance === true).length;
    const tolerance_compliance =
      measuredCount > 0 ? Math.round((inTolCount / measuredCount) * 100) : 0;

    // 7) Build response strictly to BatchQADataResponse shape
    const response: BatchQADataResponse = {
      batch: {
        // spread the DB batch (we only need id/status/created_at, but spreading is fine)
        ...(batch as unknown as Omit<
          BatchQADataResponse['batch'],
          'product_name' | 'tolerance_compliance'
        >),
        product_name: batch.products?.name ?? '',
        tolerance_compliance,
      },
      ingredients: ingredients ?? [],
      checkpoints: (checkpoints ?? []).map((cp) => ({
        // strip the raw left-join array and expose only the first check as 'check'
        id: cp.id,
        code: cp.code,
        name: cp.name,
        description: cp.description,
        stage: cp.stage,
        required: cp.required,
        display_order: cp.display_order,
        active: cp.active,
        created_at: cp.created_at,
        check: Array.isArray(cp.batch_qa_checks) ? cp.batch_qa_checks[0] : undefined,
      })),
      documents: (documents ?? []).map((doc) => ({
        id: doc.id,
        batch_id: doc.batch_id,
        document_type_id: doc.document_type_id,
        document_number: doc.document_number,
        file_url: doc.file_url,
        file_name: doc.file_name,
        status: doc.status,
        uploaded_by: doc.uploaded_by,
        uploaded_at: doc.uploaded_at,
        approved_by: doc.approved_by,
        approved_at: doc.approved_at,
        rejection_reason: doc.rejection_reason,
        notes: doc.notes,
        metadata: doc.metadata, // from QADocument
        expires_at: doc.expires_at, // from QADocument
        document_type_name: doc.qa_document_types?.name ?? 'Unknown',
      })),
      release: release ?? undefined,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('Error fetching batch QA data:', err);
    return NextResponse.json({ error: 'Failed to fetch QA data' }, { status: 500 });
  }
}
