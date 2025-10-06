'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, Loader2, Trash2 } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import DeleteBatchModal from '@/components/DeleteBatchModal';

/* =========================================
   Types
   ========================================= */
type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

interface MaterialTraceRow {
  material_id: string;
  material_name: string;
  unit: Unit;
  target_amount: number;
  used_amount: number;          // (not used for status)
  remaining_amount: number;     // (not used for status)
  is_critical: boolean;
  tolerance_percentage: number;
  lots: unknown[];              // (ignored in this screen)
}

interface TraceResp {
  batch?: { id?: string; recipe_id?: string | null; scale?: number };
  materials?: MaterialTraceRow[];
}

type BatchStatus = 'in_progress' | 'completed' | 'cancelled' | 'released';

interface BatchDetails {
  id: string;
  batch_number: string;
  recipe_id: string | null;
  beef_weight_kg: number;
  scaling_factor: number | null;
  production_date: string;
  status: BatchStatus;
  recipe?: { name: string; recipe_code: string };
}

interface BatchResp {
  batch?: BatchDetails;
}

interface ActualRow {
  id: string;
  material_id: string | null;
  ingredient_name: string;
  target_amount: number;     // convenience
  actual_amount: number | null;
  unit: Unit;
  tolerance_percentage: number;
  in_tolerance: boolean | null;
  measured_at: string | null;
}

interface ActualsResp {
  actuals?: ActualRow[];
}

type QaStage =
  | 'preparation'
  | 'mixing'
  | 'marination'
  | 'drying'
  | 'packaging'
  | 'final';

interface QaStageCount {
  stage: QaStage;
  total: number;
  done: number;
}

interface QaSummaryResp {
  current_stage: QaStage;
  percent_complete: number; // 0..100
  counts: QaStageCount[];
}

/* handy guard */
function isOkResponse(res: Response) {
  return res.ok && res.headers.get('content-type')?.includes('application/json');
}

/* =========================================
   Component
   ========================================= */
export default function BatchDetailPage() {
  const params = useParams<{ batchId: string }>();
  const router = useRouter();
  const batchId = params.batchId;

  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [materials, setMaterials] = useState<MaterialTraceRow[]>([]);
  const [actuals, setActuals] = useState<Record<string, ActualRow>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Optional QA summary for stage/progress (gracefully absent if API not present)
  const [qaSummary, setQaSummary] = useState<QaSummaryResp | null>(null);

  // Local editable inputs per material
  const [actualInputs, setActualInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      try {
        const [bRes, tRes, aRes, qRes] = await Promise.all([
          fetch(`/api/batches/${batchId}`),
          fetch(`/api/batches/${batchId}/traceability`),
          fetch(`/api/batches/${batchId}/ingredients/actuals`),
          fetch(`/api/batches/${batchId}/qa/summary`).catch(() => new Response(null, { status: 404 })),
        ]);

        // batch
        if (isOkResponse(bRes)) {
          const bJson = (await bRes.json()) as BatchResp;
          setBatch(bJson.batch ?? null);
        } else {
          setBatch(null);
        }

        // traceability / recipe targets
        if (isOkResponse(tRes)) {
          const tJson = (await tRes.json()) as TraceResp;
          setScale(typeof tJson.batch?.scale === 'number' ? tJson.batch.scale : 1);
          setMaterials(Array.isArray(tJson.materials) ? tJson.materials : []);
        } else {
          setScale(1);
          setMaterials([]);
        }

        // actuals
        if (isOkResponse(aRes)) {
          const aJson = (await aRes.json()) as ActualsResp;
          const map: Record<string, ActualRow> = {};
          for (const row of aJson.actuals ?? []) {
            if (row.material_id) map[row.material_id] = row;
          }
          setActuals(map);

          const seed: Record<string, string> = {};
          for (const m of Array.isArray((await tRes.clone().json().catch(() => ({} as TraceResp))).materials)
            ? ((await tRes.clone().json()) as TraceResp).materials!
            : []) {
            const current = map[m.material_id]?.actual_amount ?? '';
            seed[m.material_id] = current === '' ? '' : String(current);
          }
          // If the above clone path is too defensive, just seed from materials state after it’s set:
          if (Object.keys(seed).length === 0) {
            const simplerSeed: Record<string, string> = {};
            for (const m of Array.isArray(materials) ? materials : []) {
              const current = map[m.material_id]?.actual_amount ?? '';
              simplerSeed[m.material_id] = current === '' ? '' : String(current);
            }
            setActualInputs(simplerSeed);
          } else {
            setActualInputs(seed);
          }
        } else {
          setActuals({});
          setActualInputs({});
        }

        // QA summary (optional)
        if (isOkResponse(qRes)) {
          const qJson = (await qRes.json()) as QaSummaryResp;
          setQaSummary(qJson);
        } else {
          setQaSummary(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [batchId]); // only depends on the route param

  const isLocked = batch?.status === 'completed';

  const rows = useMemo(() => {
    return materials.map((m) => {
      const a = actuals[m.material_id];
      const tol = a?.tolerance_percentage ?? m.tolerance_percentage;

      const raw = actualInputs[m.material_id];
      const actualVal =
        raw !== undefined && raw !== '' ? Number(raw) : a?.actual_amount ?? null;

      const target = m.target_amount;
      const diffPct =
        actualVal != null && target > 0
          ? (Math.abs(actualVal - target) / target) * 100
          : null;
      const inTol = diffPct == null ? null : diffPct <= tol;

      return {
        ...m,
        tol,
        actualVal,
        diffPct,
        inTol,
      };
    });
  }, [materials, actuals, actualInputs]);

  const allCriticalOk = useMemo(() => {
    if (rows.length === 0) return false;
    // If there are no criticals, allow; if there are, all must be inTol === true
    const criticals = rows.filter((r) => r.is_critical);
    if (criticals.length === 0) return true;
    return criticals.every((r) => r.inTol === true);
  }, [rows]);

  async function saveActual(material_id: string, unit: Unit) {
    const raw = actualInputs[material_id];
    const amt = Number(raw);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert('Please enter a positive number.');
      return;
    }

    setSaving((s) => ({ ...s, [material_id]: true }));
    try {
      const res = await fetch(`/api/batches/${batchId}/ingredients/actuals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material_id, actual_amount: amt, unit }),
      });
      const j = (await res.json().catch(() => ({}))) as { actual?: ActualRow; error?: string };
      if (!res.ok || !j.actual) {
        alert(j.error ?? 'Failed to save actual');
        return;
      }
      setActuals((prev) => ({ ...prev, [material_id]: j.actual! }));
      setSavedFlash((f) => ({ ...f, [material_id]: true }));
      setTimeout(() => {
        setSavedFlash((f) => ({ ...f, [material_id]: false }));
      }, 1200);
    } finally {
      setSaving((s) => ({ ...s, [material_id]: false }));
    }
  }

  async function completeBatch() {
    if (!batch) return;
    if (!allCriticalOk) {
      const proceed = confirm(
        'Some critical ingredients are missing or out of tolerance. Complete anyway?'
      );
      if (!proceed) return;
    }
    const res = await fetch(`/api/batches/${batchId}/complete`, { method: 'POST' });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; status?: BatchStatus };
    if (!res.ok || j.ok !== true) {
      alert(j.error ?? 'Failed to complete batch');
      return;
    }
    setBatch((b) => (b ? { ...b, status: j.status ?? 'completed' } : b));
  }

  /* =========================================
     UI helpers
     ========================================= */
  const stageOrder: QaStage[] = [
    'preparation',
    'mixing',
    'marination',
    'drying',
    'packaging',
    'final',
  ];

  function prettyStage(s: QaStage) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* =========================================
     Render
     ========================================= */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12">Loading batch…</div>
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
      <div className="max-w-6xl mx-auto px-6 py-6">
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
          </div>
        </div>

        {/* Batch + Stage Info */}
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-lg bg-gray-50">
              <p className="text-xs text-gray-500">Production Date</p>
              <p className="font-semibold mt-1">
                {new Date(batch.production_date).toLocaleDateString()}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-gray-50">
              <p className="text-xs text-gray-500">Beef Input Weight</p>
              <p className="font-semibold mt-1">{Number(batch.beef_weight_kg).toFixed(2)} kg</p>
            </div>
            <div className="p-4 rounded-lg bg-gray-50">
              <p className="text-xs text-gray-500">Scale</p>
              <p className="font-semibold mt-1">{scale.toFixed(2)}×</p>
            </div>
          </div>

          {/* Optional stage progress */}
          {qaSummary && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">QA Progress</h3>
                <span className="text-sm text-gray-600">
                  {prettyStage(qaSummary.current_stage)} · {qaSummary.percent_complete.toFixed(0)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                {stageOrder.map((s, i) => {
                  const doneUpTo =
                    stageOrder.indexOf(qaSummary.current_stage) > i ||
                    qaSummary.percent_complete === 100;
                  const isCurrent = qaSummary.current_stage === s && qaSummary.percent_complete < 100;

                  return (
                    <div key={s} className="flex items-center gap-2">
                      <div
                        className={`px-3 py-1 rounded-full text-xs ${
                          isCurrent
                            ? 'bg-indigo-100 text-indigo-700'
                            : doneUpTo
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {prettyStage(s)}
                      </div>
                      {i < stageOrder.length - 1 && (
                        <div className="h-0.5 w-6 bg-gray-200" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Recipe Targets & Actuals */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recipe Targets & Actuals</h2>
            {isLocked && (
              <span className="text-sm text-gray-500">This batch is completed — editing disabled.</span>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="text-gray-500">No recipe ingredients found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr className="text-left">
                    <th className="py-3 px-4 font-medium">Ingredient</th>
                    <th className="py-3 px-4 font-medium">Target</th>
                    <th className="py-3 px-4 font-medium w-64">Actual used</th>
                    <th className="py-3 px-4 font-medium">Tol%</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.material_id} className="align-middle">
                      <td className="py-3 px-4">
                        <div className="font-medium">{r.material_name}</div>
                        {r.is_critical && (
                          <div className="text-[11px] text-red-600 mt-0.5">Critical</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-2">
                          <span className="font-semibold">{r.target_amount.toFixed(2)}</span>
                          <span className="text-gray-600">{r.unit}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={actualInputs[r.material_id] ?? ''}
                            onChange={(e) =>
                              setActualInputs((prev) => ({
                                ...prev,
                                [r.material_id]: e.target.value,
                              }))
                            }
                            placeholder="0.00"
                            className="w-36 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:bg-gray-100"
                            disabled={isLocked}
                          />
                          <span className="text-gray-600">{r.unit}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">{r.tol}</td>
                      <td className="py-3 px-4">
                        {r.actualVal == null || r.actualVal === 0 ? (
                          <span className="text-gray-400">—</span>
                        ) : r.inTol ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2 py-0.5">
                            <Check className="w-3 h-3" />
                            OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5">
                            Out
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => saveActual(r.material_id, r.unit)}
                          disabled={
                            isLocked ||
                            saving[r.material_id] === true ||
                            (actualInputs[r.material_id] ?? '') === ''
                          }
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                            saving[r.material_id]
                              ? 'bg-indigo-300 text-white'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          } disabled:opacity-50`}
                          title="Save"
                        >
                          {saving[r.material_id] ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving…
                            </>
                          ) : savedFlash[r.material_id] ? (
                            <>
                              <Check className="w-4 h-4" />
                              Saved
                            </>
                          ) : (
                            'Save'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => (window.location.href = `/qa/${batchId}`)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            QA Management
          </button>

          <button
            onClick={() => (window.location.href = `/recipe/print/${batchId}`)}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
          >
            Print Batch Record
          </button>

          {!isLocked ? (
            <button
              onClick={completeBatch}
              className={`px-6 py-2 rounded-lg text-white ${
                allCriticalOk
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
              title={
                allCriticalOk
                  ? 'Complete batch'
                  : 'Some critical ingredients are missing or out of tolerance'
              }
            >
              Mark as Complete
            </button>
          ) : null}

          <button
            onClick={() => setShowDeleteModal(true)}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

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
