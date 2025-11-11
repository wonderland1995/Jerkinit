import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('lot_recalls')
    .select(
      `
        id,
        reason,
        notes,
        initiated_at,
        initiated_by,
        status,
        lot:lots (
          id,
          lot_number,
          internal_lot_code,
          status,
          recall_reason,
          recall_notes,
          material:materials(name)
        ),
        lot_recall_batches (
          batch:batches (
            id,
            batch_id,
            status,
            release_status,
            product:products(name)
          )
        )
      `,
    )
    .order('initiated_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const recalls = (data ?? []).map((record) => {
    const lot = Array.isArray(record.lot) ? record.lot[0] : record.lot;
    const batchesRaw = Array.isArray(record.lot_recall_batches) ? record.lot_recall_batches : [];
    const batches = batchesRaw
      .map((row) => {
        const batchRel = row.batch;
        const batch = Array.isArray(batchRel) ? batchRel[0] : batchRel;
        if (!batch) return null;
        const productRel = batch.product;
        const product = Array.isArray(productRel) ? productRel[0] : productRel;
        return {
          id: batch.id,
          batch_id: batch.batch_id,
          status: batch.status,
          release_status: batch.release_status,
          product_name: product?.name ?? null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    return {
      id: record.id,
      reason: record.reason,
      notes: record.notes,
      initiated_at: record.initiated_at,
      initiated_by: record.initiated_by,
      status: record.status,
      lot: lot
        ? {
            id: lot.id,
            lot_number: lot.lot_number,
            internal_lot_code: lot.internal_lot_code,
            status: lot.status,
            material_name: (() => {
              const materialRel = lot.material;
              if (!materialRel) return null;
              const material = Array.isArray(materialRel) ? materialRel[0] : materialRel;
              return material?.name ?? null;
            })(),
            recall_reason: lot.recall_reason,
            recall_notes: lot.recall_notes,
          }
        : null,
      batches,
    };
  });

  return NextResponse.json({ recalls });
}
