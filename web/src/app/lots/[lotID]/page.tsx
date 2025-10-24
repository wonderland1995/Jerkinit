import { notFound } from 'next/navigation';
import { createClient } from '@/lib/db';
import { formatDate, formatDateTime, formatQuantity } from '@/lib/utils';

type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

interface LotRow {
  id: string;
  lot_number: string;
  internal_lot_code: string | null;
  current_balance: number;
  received_date: string | null;
  expiry_date: string | null;
  material: {
    id: string;
    name: string;
    category: string | null;
    unit: Unit | null;
  } | null;
  supplier: { name: string | null } | null;
}

interface UsageRow {
  id: string;
  quantity_used: number;
  unit: Unit | string | null;
  allocated_at: string | null;
  batch: { id: string; batch_number: string | null } | Array<{ id: string; batch_number: string | null }> | null;
}

type LotQueryRow = Omit<LotRow, 'material' | 'supplier'> & {
  material: LotRow['material'] | LotRow['material'][] | null;
  supplier: LotRow['supplier'] | LotRow['supplier'][] | null;
};

export const dynamic = 'force-dynamic';

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ lotID: string }>;
}) {
  const { lotID } = await params;
  const supabase = createClient();

  const { data: lotRaw, error: lotError } = await supabase
    .from('lots')
    .select(
      `
        id,
        lot_number,
        internal_lot_code,
        current_balance,
        received_date,
        expiry_date,
        material:materials ( id, name, category, unit ),
        supplier:suppliers ( name )
      `
    )
    .eq('id', lotID)
    .maybeSingle();

  if (lotError) {
    console.error('Failed to load lot', lotError);
    throw new Error(lotError.message);
  }

  const lotRecordRaw = (lotRaw ?? null) as LotQueryRow | null;

  if (!lotRecordRaw) {
    notFound();
  }
  const material = Array.isArray(lotRecordRaw.material)
    ? lotRecordRaw.material[0] ?? null
    : lotRecordRaw.material ?? null;
  const supplier = Array.isArray(lotRecordRaw.supplier)
    ? lotRecordRaw.supplier[0] ?? null
    : lotRecordRaw.supplier ?? null;

  const lotRecord: LotRow = {
    ...lotRecordRaw,
    material,
    supplier,
  };
  const lotUnit = (material?.unit ?? 'g') as Unit;

  const { data: usageRaw, error: usageError } = await supabase
    .from('batch_lot_usage')
    .select(
      `
        id,
        quantity_used,
        unit,
        allocated_at,
        batch:batches ( id, batch_number )
      `
    )
    .eq('lot_id', lotID)
    .order('allocated_at', { ascending: true });

  if (usageError) {
    console.error('Failed to load lot usage', usageError);
    throw new Error(usageError.message);
  }

  const usages = (usageRaw ?? []) as UsageRow[];

  const normalizedUsages = usages.map((row) => {
    const batchRel = row.batch;
    const batch = Array.isArray(batchRel) ? batchRel[0] : batchRel;
    const unit: Unit = (row.unit as Unit | undefined) ?? lotUnit;
    return {
      id: row.id,
      quantity: row.quantity_used,
      unit,
      allocatedAt: row.allocated_at,
      batchId: batch?.id ?? null,
      batchNumber: batch?.batch_number ?? null,
    };
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-slate-900">Lot {lotRecord.lot_number}</h1>
          {lotRecord.internal_lot_code ? (
            <p className="mt-1 text-sm text-slate-600">
              Internal code: <span className="font-mono">{lotRecord.internal_lot_code}</span>
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium uppercase text-slate-500">Material</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {material?.name ?? 'Unknown material'}
            </p>
            {material?.category ? (
              <p className="text-sm text-slate-500">{material.category}</p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase text-slate-500">Supplier</p>
                <p className="mt-1 text-slate-800">{supplier?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Current balance</p>
                <p className="mt-1 text-slate-800">
                  {formatQuantity(lotRecord.current_balance ?? 0, lotUnit)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Received</p>
                <p className="mt-1 text-slate-800">{formatDate(lotRecord.received_date)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Expiry</p>
                <p className="mt-1 text-slate-800">{formatDate(lotRecord.expiry_date)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium uppercase text-slate-500">Identifiers</p>
            <dl className="mt-2 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Lot ID</dt>
                <dd className="font-mono text-slate-800">{lotRecord.id}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Material ID</dt>
                <dd className="font-mono text-slate-800">{material?.id ?? '—'}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Batch allocations</h2>
          </div>
          {normalizedUsages.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">This lot has not been allocated to any batches yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Batch</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Quantity used</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Recorded at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {normalizedUsages.map((usage) => (
                    <tr key={usage.id}>
                      <td className="px-5 py-3">
                        {usage.batchNumber ? (
                          <span className="font-medium text-slate-800">{usage.batchNumber}</span>
                        ) : (
                          <span className="text-slate-500">Unknown batch</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-800">
                        {formatQuantity(usage.quantity, usage.unit)}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {formatDateTime(usage.allocatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
