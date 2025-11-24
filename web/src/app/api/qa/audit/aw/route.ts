import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';

type AwMetadata =
  | {
      lab_aw?: {
        sample_id?: string | null;
        lab_name?: string | null;
        sent_iso?: string | null;
        result_iso?: string | null;
        result_aw?: number | string | null;
      } | null;
    }
  | Record<string, unknown>
  | null;

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

export async function GET() {
  const supabase = createServerClient();

  const { data: checkpointRow } = await supabase
    .from('qa_checkpoints')
    .select('id, code, name')
    .eq('code', 'DRY-FSP-AW-LAB')
    .maybeSingle();

  const checkpointId = checkpointRow?.id ?? null;
  let awChecks: unknown[] = [];
  if (checkpointId) {
    const { data, error } = await supabase
      .from('batch_qa_checks')
      .select(
        `
          id,
          batch_id,
          status,
          checked_at,
          checked_by,
          water_activity,
          notes,
          metadata,
          created_at,
          batch:batches ( id, batch_id, status, created_at )
        `,
      )
      .eq('checkpoint_id', checkpointId)
      .order('checked_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6);

    if (!error && Array.isArray(data)) {
      awChecks = data.map((row) => {
        const meta = (row.metadata as AwMetadata) ?? null;
        const labMeta =
          meta && typeof meta === 'object' && 'lab_aw' in meta && typeof meta.lab_aw === 'object'
            ? (meta.lab_aw as Record<string, unknown>)
            : null;

        const awValue = toNumber(row.water_activity ?? labMeta?.['result_aw']);

        return {
          id: row.id,
          batch_id: row.batch_id,
          batch_code: (row as { batch?: { batch_id?: string | null } | null }).batch?.batch_id ?? null,
          status: row.status ?? null,
          checked_at: row.checked_at ?? row.created_at ?? null,
          checked_by: row.checked_by ?? null,
          water_activity: awValue,
          sample_id: typeof labMeta?.['sample_id'] === 'string' ? labMeta?.['sample_id'] : null,
          lab_name: typeof labMeta?.['lab_name'] === 'string' ? labMeta?.['lab_name'] : null,
          sent_at: typeof labMeta?.['sent_iso'] === 'string' ? labMeta?.['sent_iso'] : null,
          result_at: typeof labMeta?.['result_iso'] === 'string' ? labMeta?.['result_iso'] : null,
          notes: row.notes ?? null,
        };
      });
    }
  }

  const { data: docType } = await supabase
    .from('qa_document_types')
    .select('id, code, name')
    .eq('code', 'LAB-AW-RESULT')
    .maybeSingle();

  let documents: unknown[] = [];
  if (docType?.id) {
    const { data } = await supabase
      .from('qa_documents')
      .select(
        `
          id,
          batch_id,
          file_url,
          file_name,
          document_number,
          status,
          uploaded_at,
          notes,
          document_type:qa_document_types ( code, name )
        `,
      )
      .eq('document_type_id', docType.id)
      .order('uploaded_at', { ascending: false })
      .limit(6);

    if (Array.isArray(data)) {
      documents = data;
    }
  }

  return NextResponse.json({
    checkpoint: checkpointRow ?? null,
    awChecks,
    documents,
  });
}
