'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import DeleteBatchModal from '@/components/DeleteBatchModal';

/* ===========================
   Types
   =========================== */
type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

interface LotBreakdown {
  usage_id: string;
  lot_id: string;
  lot_number: string;
  internal_lot_code: string;
  quantity_used: number;
  unit: Unit;
  supplier_name: string | null;
  received_date: string | null;
  expiry_date: string | null;
}

interface MaterialTraceRow {
  material_id: string;
  material_name: string;
  unit: Unit;
  target_amount: number;      // scaled from recipe
  used_amount: number;        // sum of allocations
  remaining_amount: number;   // target - used
  is_critical: boolean;
  tolerance_percentage: number;
  lots: LotBreakdown[];       // per-lot breakdown
}

interface BatchDetails {
  id: string;
  batch_number: string;
  recipe_id: string | null;
  beef_weight_kg: number;     // ✅ DB uses kg
  scaling_factor: number | null;
  production_date: string;
  status: string;
  recipe?: {
    name: string;
    recipe_code: string;
  };
}

interface ApiBatchResponse {
  batch?: BatchDetails;
}

interface ApiTraceResponse {
  batch?: { id?: string; recipe_id?: string | null; scale?: number };
  materials?: MaterialTraceRow[];
}

type LotPick = {
  id: string;
  lot_number: string;
  internal_lot_code: string;
  current_balance: number; // in material.unit
  unit: Unit;              // material.unit
  supplier_name: string | null;
  received_date: string | null;
  expiry_date: string | null;
};

interface LotApiRow {
  id: string;
  lot_number: string;
  internal_lot_code: string;
  current_balance: number | string;
  supplier?: { name?: string | null } | null;
  material?: { unit?: string | null } | null;
  received_date?: string | null;
  expiry_date?: string | null;
}

/* ===========================
   Helpers
   =========================== */
function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  // weight
  if (from === 'kg' && to === 'g') return value * 1000;
  if (from === 'g' && to === 'kg') return value / 1000;
  // volume
  if (from === 'L' && to === 'ml') return value * 1000;
  if (from === 'ml' && to === 'L') return value / 1000;
  // "units" or mismatched systems -> leave as-is
  return value;
}

const validUnits: ReadonlySet<Unit> = new Set(['g', 'kg', 'ml', 'L', 'units']);
const toUnit = (x: unknown, fallback: Unit): Unit =>
  typeof x === 'string' && validUnits.has(x as Unit) ? (x as Unit) : fallback;

/* ===========================
   Component
   =========================== */
export default function BatchDetailPage() {
  const params = useParams<{ batchId: string }>();
  const router = useRouter();
  const batchId = params.batchId;

  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [materials, setMaterials] = useState<MaterialTraceRow[]>([]);
  const [scale, setScale] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Allocation UI state
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocFor, setAllocFor] = useState<MaterialTraceRow | null>(null);
  const [lotQuery, setLotQuery] = useState('');
  const [lots, setLots] = useState<LotPick[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [allocQty, setAllocQty] = useState<string>(''); // quantity in the ingredient's unit
  const [allocSaving, setAllocSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function fetchBatch() {
    const [batchRes, traceRes] = await Promise.all([
      fetch(`/api/batches/${batchId}`),
      fetch(`/api/batches/${batchId}/traceability`),
    ]);

    const batchJson = (await batchRes.json().catch(() => ({}))) as ApiBatchResponse;
    const traceJson = (await traceRes.json().catch(() => ({}))) as ApiTraceResponse;

    setBatch(batchJson.batch ?? null);

    if (traceRes.ok && Array.isArray(traceJson.materials)) {
      setMaterials(traceJson.materials);
      setScale(typeof traceJson.batch?.scale === 'number' ? traceJson.batch.scale : 1);
    } else {
      setMaterials([]);
      setScale(1);
    }

    setLoading(false);
  }

  useEffect(() => {
    void fetchBatch();
  }, [batchId]);

  async function openAllocate(row: MaterialTraceRow) {
    setAllocFor(row);
    setAllocOpen(true);
    setLotQuery('');
    setSelectedLotId('');
    setAllocQty('');

    const res = await fetch(`/api/lots?material_id=${row.material_id}&q=${encodeURIComponent('')}`);
    const data = (await res.json()) as { lots?: LotApiRow[] };
    const lotsArr = Array.isArray(data.lots) ? data.lots : [];

    const mapped: LotPick[] = lotsArr.map((l) => ({
      id: l.id,
      lot_number: l.lot_number,
      internal_lot_code: l.internal_lot_code,
      current_balance: Number(l.current_balance) || 0,
      unit: toUnit(l.material?.unit ?? row.unit, row.unit),
      supplier_name: l.supplier?.name ?? null,
      received_date: l.received_date ?? null,
      expiry_date: l.expiry_date ?? null,
    }));
    setLots(mapped);
  }

  async function saveAllocation() {
    if (!allocFor || !selectedLotId) return;
    const qtyInRowUnit = Number(allocQty);
    if (!Number.isFinite(qtyInRowUnit) || qtyInRowUnit <= 0) {
      alert('Enter a quantity greater than 0');
      return;
    }

    // Validate against lot balance (convert lot balance to the row unit)
    const lot = lots.find((l) => l.id === selectedLotId);
    if (!lot) return;

    const lotBalanceInRowUnit = convert(lot.current_balance, lot.unit, allocFor.unit);
    if (qtyInRowUnit > lotBalanceInRowUnit + 1e-9) {
      alert(`Exceeds lot balance (${lotBalanceInRowUnit.toFixed(2)} ${allocFor.unit})`);
      return;
    }

    setAllocSaving(true);
    try {
      const res = await fetch(`/api/batches/${batchId}/traceability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: [
            {
              lot_id: selectedLotId,
              material_id: allocFor.material_id,
              quantity_used: qtyInRowUnit,
              unit: allocFor.unit, // store in ingredient's unit; API will convert for lot balance
            },
          ],
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        alert(j.error ?? 'Failed to allocate');
        setAllocSaving(false);
        return;
      }
      setAllocOpen(false);
      await fetchBatch(); // refresh
    } finally {
      setAllocSaving(false);
    }
  }

  async function removeAllocation(usageId: string) {
    try {
      setRemovingId(usageId);
      const res = await fetch(
        `/api/batches/${batchId}/traceability?usage_id=${encodeURIComponent(usageId)}`,
        { method: 'DELETE' }
      );
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) {
        alert(json.error ?? 'Failed to remove allocation');
        return;
      }
      await fetchBatch();
    } finally {
      setRemovingId(null);
    }
  }

  /* ===========================
     Render
     =========================== */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12">Loading batch...</div>
      </div>
    );
  }
  if (!batch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12">Batch not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/' },
            { label: 'Batches', href: '/batches' },
            { label: batch.batch_number, href: `/batches/${batchId}` },
          ]}
        />

        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">{batch.batch_number}</h1>
            {batch.recipe && (
              <p className="text-gray-600 mt-1">
                Recipe: {batch.recipe.name} ({batch.recipe.recipe_code})
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-4 py-2 rounded-full text-sm font-medium ${
                batch.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : batch.status === 'in_progress'
                  ? 'bg-yellow-100 text-yellow-800'
                  : batch.status === 'released'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {batch.status.replace('_', ' ').toUpperCase()}
            </span>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        {/* Batch Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Batch Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Production Date</p>
              <p className="font-medium">
                {new Date(batch.production_date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Beef Input Weight</p>
              <p className="font-medium">{Number(batch.beef_weight_kg).toFixed(2)} kg</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Scaling Factor</p>
              <p className="font-medium">{scale.toFixed(2)}×</p>
            </div>
          </div>
        </div>

        {/* Recipe Targets & Allocations */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recipe Targets & Allocations</h2>
          </div>

          {materials.length === 0 ? (
            <p className="text-gray-500">No recipe ingredients or allocations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4">Ingredient</th>
                    <th className="py-2 pr-4">Target</th>
                    <th className="py-2 pr-4">Used</th>
                    <th className="py-2 pr-4">Remaining</th>
                    <th className="py-2 pr-4">Critical</th>
                    <th className="py-2 pr-4">Tol%</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => {
                    const diffPct =
                      m.target_amount > 0
                        ? (Math.abs(m.used_amount - m.target_amount) / m.target_amount) * 100
                        : 0;
                    const hasUsed = m.used_amount > 0;
                    const inTol = hasUsed ? diffPct <= m.tolerance_percentage : null;
                    const canAllocate = m.remaining_amount > 0.0001;

                    return (
                      <tr key={m.material_id} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-4">
                          <div className="font-medium">{m.material_name}</div>
                          {/* Per-lot breakdown (with remove buttons) */}
                          {m.lots.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {m.lots.map((l) => (
                                <div
                                  key={l.usage_id}
                                  className="text-xs text-gray-600 flex justify-between items-center bg-gray-50 px-2 py-1 rounded"
                                >
                                  <span>
                                    Lot {l.lot_number} ({l.internal_lot_code})
                                    {l.supplier_name ? ` · ${l.supplier_name}` : ''}
                                  </span>
                                  <span className="flex items-center gap-2">
                                    {l.quantity_used.toFixed(2)} {l.unit}
                                    <button
                                      onClick={() => removeAllocation(l.usage_id)}
                                      disabled={removingId === l.usage_id}
                                      className={`ml-2 ${
                                        removingId === l.usage_id
                                          ? 'text-gray-400'
                                          : 'text-red-600 hover:text-red-800'
                                      }`}
                                      title="Remove allocation"
                                      aria-label="Remove allocation"
                                    >
                                      {removingId === l.usage_id ? '…' : '×'}
                                    </button>
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {m.target_amount.toFixed(2)} {m.unit}
                        </td>
                        <td className="py-2 pr-4">
                          {m.used_amount.toFixed(2)} {m.unit}
                        </td>
                        <td className="py-2 pr-4">
                          {m.remaining_amount.toFixed(2)} {m.unit}
                        </td>
                        <td className="py-2 pr-4">{m.is_critical ? 'Yes' : 'No'}</td>
                        <td className="py-2 pr-4">{m.tolerance_percentage}</td>
                        <td className="py-2 pr-4">
                          {!hasUsed ? (
                            <span className="text-gray-400">—</span>
                          ) : inTol ? (
                            <span className="px-2 py-0.5 rounded bg-green-100 text-green-700">
                              OK
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-700">
                              Out
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            onClick={() => openAllocate(m)}
                            disabled={!canAllocate}
                            className={`px-3 py-1.5 rounded ${
                              canAllocate
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            }`}
                            title={canAllocate ? 'Allocate lot' : 'Target fulfilled'}
                          >
                            Allocate lot
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => (window.location.href = `/qa/${batchId}`)}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            QA Management
          </button>
          <button
            onClick={() => (window.location.href = `/recipe/print/${batchId}`)}
            className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
          >
            Print Batch Record
          </button>
        </div>
      </div>

      {/* Allocate Modal */}
      {allocOpen && allocFor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">Allocate lot · {allocFor.material_name}</h3>
              <button
                onClick={() => setAllocOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Target</p>
                  <p className="font-medium">
                    {allocFor.target_amount.toFixed(2)} {allocFor.unit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Used</p>
                  <p className="font-medium">
                    {allocFor.used_amount.toFixed(2)} {allocFor.unit}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Remaining</p>
                  <p className="font-medium">
                    {allocFor.remaining_amount.toFixed(2)} {allocFor.unit}
                  </p>
                </div>
              </div>

              {/* Lot search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lot</label>
                <div className="flex gap-2">
                  <input
                    value={lotQuery}
                    onChange={async (e) => {
                      setLotQuery(e.target.value);
                      if (!allocFor) return;

                      const res = await fetch(
                        `/api/lots?material_id=${allocFor.material_id}&q=${encodeURIComponent(
                          e.target.value
                        )}`
                      );
                      const data = (await res.json()) as { lots?: LotApiRow[] };
                      const lotsArr = Array.isArray(data.lots) ? data.lots : [];

                      const mapped: LotPick[] = lotsArr.map((l) => ({
                        id: l.id,
                        lot_number: l.lot_number,
                        internal_lot_code: l.internal_lot_code,
                        current_balance: Number(l.current_balance) || 0,
                        unit: toUnit(l.material?.unit ?? allocFor.unit, allocFor.unit),
                        supplier_name: l.supplier?.name ?? null,
                        received_date: l.received_date ?? null,
                        expiry_date: l.expiry_date ?? null,
                      }));
                      setLots(mapped);
                    }}
                    placeholder="Search lot number…"
                    className="border rounded px-3 py-2 flex-1"
                  />
                </div>

                <div className="mt-2 max-h-44 overflow-auto border rounded">
                  {lots.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No available lots</div>
                  ) : (
                    lots.map((l) => {
                      const balanceInRowUnit = convert(l.current_balance, l.unit, allocFor.unit);
                      const active = l.id === selectedLotId;
                      return (
                        <button
                          key={l.id}
                          onClick={() => setSelectedLotId(l.id)}
                          className={`w-full text-left px-3 py-2 border-b last:border-0 ${
                            active ? 'bg-indigo-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex justify-between">
                            <div>
                              <div className="font-medium">
                                Lot {l.lot_number} ({l.internal_lot_code})
                              </div>
                              <div className="text-xs text-gray-500">
                                {l.supplier_name ?? '—'} · Rec{' '}
                                {l.received_date
                                  ? new Date(l.received_date).toLocaleDateString()
                                  : '—'}
                                {l.expiry_date
                                  ? ` · Exp ${new Date(l.expiry_date).toLocaleDateString()}`
                                  : ''}
                              </div>
                            </div>
                            <div className="text-sm">
                              Bal: {balanceInRowUnit.toFixed(2)} {allocFor.unit}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity ({allocFor.unit})
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={allocQty}
                    onChange={(e) => setAllocQty(e.target.value)}
                    className="border rounded px-3 py-2 flex-1"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    className="px-3 py-2 border rounded hover:bg-gray-50"
                    onClick={() => setAllocQty(allocFor.remaining_amount.toFixed(2))}
                  >
                    Allocate remaining
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setAllocOpen(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveAllocation}
                disabled={allocSaving || !selectedLotId || !allocQty}
                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {allocSaving ? 'Saving…' : 'Allocate'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteBatchModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          const res = await fetch(`/api/batches/${batchId}/delete`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete batch');
          router.push('/batches');
        }}
        batchId={batch.id}
        batchNumber={batch.batch_number}
      />
    </div>
  );
}
