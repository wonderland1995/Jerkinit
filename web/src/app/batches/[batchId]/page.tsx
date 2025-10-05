'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import DeleteBatchModal from '@/components/DeleteBatchModal';

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
  target_amount: number;          // from recipe (scaled)
  used_amount: number;            // sum of lot allocations
  remaining_amount: number;       // target - used
  is_critical: boolean;
  tolerance_percentage: number;
  lots: LotBreakdown[];           // per-lot breakdown
}

interface BatchDetails {
  id: string;
  batch_number: string;
  recipe_id: string;
  beef_input_weight: number;      // NOTE: consider renaming to beef_weight_kg and showing kg
  scaling_factor: number;
  production_date: string;
  status: string;                 // fixed typo
  recipe?: {
    name: string;
    recipe_code: string;
  };
}

export default function BatchDetailPage() {
  const params = useParams<{ batchId: string }>();
  const router = useRouter();
  const batchId = params.batchId;

  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [materials, setMaterials] = useState<MaterialTraceRow[]>([]);
  const [scale, setScale] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchBatch = async () => {
    const [batchRes, traceRes] = await Promise.all([
      fetch(`/api/batches/${batchId}`),
      fetch(`/api/batches/${batchId}/traceability`),
    ]);

    const batchJson = await batchRes.json().catch(() => ({} as never));
    const traceJson = await traceRes.json().catch(() => ({} as never));

    // Expect: { batch: {...} } and { batch: { id, recipe_id, scale }, materials: [...] }
    setBatch(batchJson.batch ?? null);
    if (traceRes.ok && traceJson && Array.isArray(traceJson.materials)) {
      setMaterials(traceJson.materials as MaterialTraceRow[]);
      setScale(typeof traceJson.batch?.scale === 'number' ? traceJson.batch.scale : 1);
    } else {
      setMaterials([]);
      setScale(1);
    }

    setLoading(false);
  };

  useEffect(() => {
    void fetchBatch();
  }, [batchId]);

  const handleDelete = async () => {
    const res = await fetch(`/api/batches/${batchId}/delete`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete batch');
    router.push('/batches');
  };

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
              {/* If this is kg in your DB, show kg or convert to g */}
              <p className="font-medium">{batch.beef_input_weight} g</p>
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
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => {
                    const diffPct =
                      m.target_amount > 0
                        ? (Math.abs(m.used_amount - m.target_amount) / m.target_amount) * 100
                        : 0;
                    const hasUsed = m.used_amount > 0;
                    const inTol = hasUsed
                      ? diffPct <= m.tolerance_percentage
                      : null;

                    return (
                      <tr key={m.material_id} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-4">
                          <div className="font-medium">{m.material_name}</div>
                          {/* Per-lot breakdown */}
                          {m.lots.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {m.lots.map((l) => (
                                <div
                                  key={l.usage_id}
                                  className="text-xs text-gray-600 flex justify-between bg-gray-50 px-2 py-1 rounded"
                                >
                                  <span>
                                    Lot {l.lot_number} ({l.internal_lot_code})
                                    {l.supplier_name ? ` · ${l.supplier_name}` : ''}
                                  </span>
                                  <span>
                                    {l.quantity_used.toFixed(2)} {l.unit}
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
            onClick={() => window.location.href = `/qa/${batchId}`}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            QA Management
          </button>
          <button
            onClick={() => window.location.href = `/recipe/print/${batchId}`}
            className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
          >
            Print Batch Record
          </button>
        </div>
      </div>

      <DeleteBatchModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        batchId={batch.id}
        batchNumber={batch.batch_number}
      />
    </div>
  );
}
