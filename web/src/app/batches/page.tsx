// src/app/batches/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2, Eye, ClipboardCheck } from 'lucide-react';
import DeleteBatchModal from '@/components/DeleteBatchModal';
import type { Route } from 'next';
import { computeBestBefore, formatDate } from '@/lib/utils';

interface BatchSummary {
  id: string;
  batch_id: string;
  product_name: string | null;
  beef_weight_kg: number | null;
  status: 'planned' | 'in_progress' | 'completed' | 'released';
  created_at: string;
  completed_at: string | null;
  created_by: string | null;
  tolerance_compliance_percent: number | null;
  qa_checkpoints_passed: number;
  qa_checkpoints_total: number;
  documents_approved: number;
  documents_required: number;
  release_status: 'approved' | 'pending' | 'hold' | 'rejected' | 'recalled' | null;
  release_number: string | null;
  best_before_date?: string | null;
}

type Stage = 'preparation' | 'mixing' | 'marination' | 'drying' | 'packaging' | 'final';
const STAGE_LABELS: Record<Stage, string> = {
  preparation: 'Preparation',
  mixing: 'Mixing',
  marination: 'Marination',
  drying: 'Drying',
  packaging: 'Packaging',
  final: 'Final',
};
const STAGE_BADGE_CLASSES: Record<Stage, string> = {
  preparation: 'bg-slate-100 text-slate-700',
  mixing: 'bg-blue-100 text-blue-700',
  marination: 'bg-amber-100 text-amber-700',
  drying: 'bg-orange-100 text-orange-700',
  packaging: 'bg-indigo-100 text-indigo-700',
  final: 'bg-emerald-100 text-emerald-700',
};
interface QaStageSummary {
  label: string;
  badgeClass: string;
  percent: number;
  stage: Stage | null;
  checkpoint: string | null;
  completed: boolean;
}

export default function BatchHistoryPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed' | 'released'>('all');
  const [searchRaw, setSearchRaw] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchSummary | null>(null);
  const [qaStages, setQaStages] = useState<Record<string, QaStageSummary | null>>({});
  const [bestBeforeDrafts, setBestBeforeDrafts] = useState<Record<string, string>>({});
  const [bestBeforeSaving, setBestBeforeSaving] = useState<Record<string, boolean>>({});
  const [bestBeforeFlash, setBestBeforeFlash] = useState<Record<string, 'saved' | 'error' | undefined>>({});

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchRaw.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchRaw]);

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    const map: Record<string, string> = {};
    batches.forEach((batch) => {
      const override = batch.best_before_date ?? null;
      const date = override ? new Date(override) : computeBestBefore(batch.created_at);
      if (date && !Number.isNaN(date.getTime())) {
        map[batch.id] = date.toISOString().slice(0, 10);
      }
    });
    setBestBeforeDrafts(map);
  }, [batches]);

  useEffect(() => {
    if (batches.length === 0) {
      setQaStages({});
      return;
    }
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        batches.map(async (batch) => {
          try {
            const res = await fetch(`/api/batches/${batch.id}/qa/progress`, { cache: 'no-store' });
            if (!res.ok) return [batch.id, null] as const;
            const data = await res.json();
            const percentRaw = typeof data.percent_complete === 'number' ? data.percent_complete : Number(data.percent_complete ?? 0);
            const percent = Number.isFinite(percentRaw) ? percentRaw : 0;
            const stage = (data.current_stage ?? null) as Stage | null;
            const completed = percent >= 100 || stage === 'final';
            const checkpointParts = data.current_checkpoint
              ? [data.current_checkpoint.code, data.current_checkpoint.name].filter((part) => typeof part === 'string' && part.trim().length > 0)
              : [];
            const checkpoint = checkpointParts.length > 0 ? checkpointParts.join(' - ') : null;
            let label: string;
            let badgeClass: string;
            if (completed) {
              label = 'QA Complete';
              badgeClass = 'bg-green-100 text-green-800';
            } else if (checkpoint) {
              label = 'Next: ' + checkpoint;
              badgeClass = stage ? (STAGE_BADGE_CLASSES[stage] ?? 'bg-gray-100 text-gray-700') : 'bg-yellow-100 text-yellow-800';
            } else if (stage) {
              label = STAGE_LABELS[stage] ?? stage;
              badgeClass = STAGE_BADGE_CLASSES[stage] ?? 'bg-gray-100 text-gray-700';
            } else {
              label = 'QA in progress';
              badgeClass = 'bg-yellow-100 text-yellow-800';
            }
            return [batch.id, { label, badgeClass, percent, stage, checkpoint, completed }] as const;
          } catch (error) {
            console.warn('Failed to load QA progress for batch', batch.id, error);
            return [batch.id, null] as const;
          }
        })
      );
      if (!cancelled) {
        setQaStages(Object.fromEntries(results));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batches]);

  async function fetchBatches() {
    try {
      setLoading(true);
      const res = await fetch('/api/batches/history', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch batches');
      const data = await res.json();
      setBatches((data.batches ?? []) as BatchSummary[]);
    } catch (err) {
      console.error('Error fetching batches:', err);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedBatch) return;

    const res = await fetch(`/api/batches/${selectedBatch.id}/delete`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error('Failed to delete batch');
    }

    await fetchBatches();
    setShowDeleteModal(false);
    setSelectedBatch(null);
  };

  const getDerivedStatus = useCallback(
    (batch: BatchSummary): BatchSummary['status'] => {
      const qa = qaStages[batch.id];
      if (batch.status === 'released' || batch.release_status === 'approved') {
        return 'released';
      }
      if (qa) {
        return qa.completed ? 'completed' : 'in_progress';
      }
      return batch.status;
    },
    [qaStages]
  );

  const effectiveBestBefore = (batch: BatchSummary): Date | null => {
    if (batch.best_before_date) {
      const parsed = new Date(batch.best_before_date);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return computeBestBefore(batch.created_at);
  };

  const bestBeforeText = (batch: BatchSummary) => {
    const date = effectiveBestBefore(batch);
    return date ? formatDate(date) : '--';
  };

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      const derivedStatus = getDerivedStatus(batch);
      if (filter !== 'all' && derivedStatus !== filter) {
        return false;
      }

      if (searchTerm) {
        return (
          batch.batch_id.toLowerCase().includes(searchTerm) ||
          (batch.product_name ?? '').toLowerCase().includes(searchTerm) ||
          (batch.created_by ?? '').toLowerCase().includes(searchTerm)
        );
      }
      return true;
    });
  }, [batches, filter, searchTerm, getDerivedStatus]);

  function getComplianceColor(percent: number | null) {
    if (percent === null) return 'text-gray-400';
    if (percent >= 95) return 'text-green-600';
    if (percent >= 80) return 'text-yellow-600';
    return 'text-red-600';
  }

  function ReleaseStatusBadge({ status }: { status: BatchSummary['release_status'] }) {
    if (!status) return null;
    const colors = {
      approved: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      hold: 'bg-orange-100 text-orange-800',
      rejected: 'bg-red-100 text-red-800',
      recalled: 'bg-purple-100 text-purple-800',
    } as const;
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colors[status] ?? 'bg-gray-100 text-gray-800'}`}>
        {status.toUpperCase()}
      </span>
    );
  }

  function formatStatusLabel(status: BatchSummary['status']) {
    const label = status.replace('_', ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  const handleBestBeforeSave = async (batch: BatchSummary) => {
    const draft = bestBeforeDrafts[batch.id]?.trim() ?? '';
    const payload = { best_before_date: draft || null };

    setBestBeforeSaving((s) => ({ ...s, [batch.id]: true }));
    setBestBeforeFlash((f) => ({ ...f, [batch.id]: undefined }));

    try {
      const res = await fetch(`/api/batches/${batch.id}/best-before`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { best_before_date?: string | null; error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? 'Failed to save best before');
      }
      const nextDate = body.best_before_date ?? payload.best_before_date;
      setBatches((prev) =>
        prev.map((b) => (b.id === batch.id ? { ...b, best_before_date: nextDate } : b))
      );
      if (nextDate) {
        setBestBeforeDrafts((d) => ({ ...d, [batch.id]: nextDate }));
      }
      setBestBeforeFlash((f) => ({ ...f, [batch.id]: 'saved' }));
      setTimeout(() => setBestBeforeFlash((f) => ({ ...f, [batch.id]: undefined })), 1500);
    } catch (err) {
      console.error(err);
      setBestBeforeFlash((f) => ({ ...f, [batch.id]: 'error' }));
    } finally {
      setBestBeforeSaving((s) => ({ ...s, [batch.id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const total = batches.length;
  const inProgress = batches.filter((b) => getDerivedStatus(b) === 'in_progress').length;
  const completed = batches.filter((b) => getDerivedStatus(b) === 'completed').length;
  const released = batches.filter((b) => b.release_status === 'approved').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Batch History</h1>
          <p className="mt-2 text-gray-600">View all production batches and their QA status</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Search</label>
              <input
                type="text"
                placeholder="Search batch ID, product, or operator..."
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                inputMode="search"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Filter Status</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Batches</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="released">Released</option>
              </select>
            </div>

            <div className="flex items-end">
              <Link
                href="/recipe/new"
                className="w-full px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 text-center"
              >
                + New Batch
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Batches" value={total} />
          <StatCard label="In Progress" value={inProgress} accent="text-yellow-600" />
          <StatCard label="Completed" value={completed} accent="text-blue-600" />
          <StatCard label="Released" value={released} accent="text-green-600" />
        </div>

        {filteredBatches.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-gray-500">
            No batches found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredBatches.map((batch) => {
              const summary = qaStages[batch.id];
              const derivedStatus = getDerivedStatus(batch);
              const fallbackBadge =
                derivedStatus === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : derivedStatus === 'released'
                  ? 'bg-blue-100 text-blue-800'
                  : derivedStatus === 'planned'
                  ? 'bg-gray-100 text-gray-700'
                  : 'bg-yellow-100 text-yellow-800';
              const label = summary?.label ?? formatStatusLabel(derivedStatus);
              const badgeClass = summary?.badgeClass ?? fallbackBadge;
              const bestBeforeValue = bestBeforeDrafts[batch.id] ?? '';
              return (
                <div key={batch.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-gray-900">{batch.batch_id}</p>
                      <p className="text-sm text-gray-600">{batch.product_name ?? '-'}</p>
                      <p className="text-xs text-gray-500">
                        Created {formatDate(batch.created_at)}
                        {batch.created_by ? ` · ${batch.created_by}` : ''}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badgeClass}`}>{label}</span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-700">
                    <div>
                      <p className="text-xs uppercase text-gray-500">Weight</p>
                      <p>{typeof batch.beef_weight_kg === 'number' ? `${batch.beef_weight_kg.toFixed(3)} kg` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-gray-500">Compliance</p>
                      <p className={`font-semibold ${getComplianceColor(batch.tolerance_compliance_percent)}`}>
                        {batch.tolerance_compliance_percent != null ? `${batch.tolerance_compliance_percent}%` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-gray-500">QA Progress</p>
                      <p>CP: {batch.qa_checkpoints_passed}/{batch.qa_checkpoints_total}</p>
                      <p>Doc: {batch.documents_approved}/{batch.documents_required}</p>
                      <p>QA %: {summary?.percent != null ? Math.round(summary.percent) : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase text-gray-500">Release</p>
                      <ReleaseStatusBadge status={batch.release_status} />
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-blue-900">Best before</p>
                      <span className="text-xs font-semibold text-blue-700">{bestBeforeText(batch)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="date"
                        value={bestBeforeValue}
                        onChange={(e) =>
                          setBestBeforeDrafts((d) => ({
                            ...d,
                            [batch.id]: e.target.value,
                          }))
                        }
                        className="flex-1 rounded-md border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      />
                      <button
                        type="button"
                        onClick={() => void handleBestBeforeSave(batch)}
                        disabled={bestBeforeSaving[batch.id]}
                        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {bestBeforeSaving[batch.id] ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                    {bestBeforeFlash[batch.id] === 'saved' && (
                      <p className="text-xs font-semibold text-emerald-700">Saved</p>
                    )}
                    {bestBeforeFlash[batch.id] === 'error' && (
                      <p className="text-xs font-semibold text-red-700">Failed to save. Try again.</p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => router.push((`/batches/${batch.id}` as `/batches/${string}`) as Route)}
                      className="flex-1 min-w-[120px] rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                    >
                      <Eye className="mr-1 h-4 w-4 inline-block" />
                      View
                    </button>
                    <button
                      onClick={() => router.push((`/qa/${batch.id}` as `/qa/${string}`) as Route)}
                      className="flex-1 min-w-[120px] rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                    >
                      <ClipboardCheck className="mr-1 h-4 w-4 inline-block" />
                      QA
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBatch(batch);
                        setShowDeleteModal(true);
                      }}
                      className="flex-1 min-w-[120px] rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                    >
                      <Trash2 className="mr-1 h-4 w-4 inline-block" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedBatch && (
        <DeleteBatchModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedBatch(null);
          }}
          onConfirm={handleDeleteConfirm}
          batchNumber={selectedBatch.batch_id}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, accent = 'text-gray-900' }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}
