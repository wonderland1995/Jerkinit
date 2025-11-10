// src/app/batches/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2, Eye, ClipboardCheck } from 'lucide-react';
import DeleteBatchModal from '@/components/DeleteBatchModal';
import type { Route } from 'next';
import { formatDate } from '@/lib/utils';

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

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchRaw.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchRaw]);

  useEffect(() => {
    fetchBatches();
  }, []);

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

        <div className="space-y-4 md:hidden">
          {filteredBatches.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-gray-500">
              No batches found.
            </div>
          ) : (
            filteredBatches.map((batch) => (
              <div key={batch.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-sm font-semibold text-gray-900">{batch.batch_id}</div>
                      <div className="text-sm text-gray-600">{batch.product_name ?? '-'}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        Created {formatDate(batch.created_at)}
                        {batch.created_by ? ` - ${batch.created_by}` : ''}
                      </div>
                    </div>
                    {(() => {
                      const summary = qaStages[batch.id];
                      const derivedStatus = getDerivedStatus(batch);
                      const fallbackLabel = formatStatusLabel(derivedStatus);
                      const fallbackBadge =
                        derivedStatus === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : derivedStatus === 'released'
                          ? 'bg-blue-100 text-blue-800'
                          : derivedStatus === 'planned'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-yellow-100 text-yellow-800';
                      const label = summary?.label ?? fallbackLabel;
                      const badge = summary?.badgeClass ?? fallbackBadge;
                      return (
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge}`}>{label}</span>
                      );
                    })()}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-700">
                    <div>
                      <div className="text-xs text-gray-500 uppercase">Weight</div>
                      <div>{typeof batch.beef_weight_kg === 'number' ? `${batch.beef_weight_kg.toFixed(3)} kg` : '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase">Compliance</div>
                      <div className={`font-semibold ${getComplianceColor(batch.tolerance_compliance_percent)}`}>
                        {batch.tolerance_compliance_percent != null ? `${batch.tolerance_compliance_percent}%` : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase">QA Progress</div>
                      <div>CP: {batch.qa_checkpoints_passed}/{batch.qa_checkpoints_total}</div>
                      <div>Doc: {batch.documents_approved}/{batch.documents_required}</div>
                      <div>QA %: {qaStages[batch.id]?.percent != null ? Math.round(qaStages[batch.id]?.percent ?? 0) : '-'}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase">Release</div>
                      <ReleaseStatusBadge status={batch.release_status} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => router.push((`/batches/${batch.id}` as `/batches/${string}`) as Route)}
                      className="flex-1 min-w-[120px] rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                    >
                      View
                    </button>
                    <button
                      onClick={() => router.push((`/qa/${batch.id}` as `/qa/${string}`) as Route)}
                      className="flex-1 min-w-[120px] rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                    >
                      QA
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBatch(batch);
                        setShowDeleteModal(true);
                      }}
                      className="flex-1 min-w-[120px] rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <Th>Batch ID</Th>
                  <Th>Product</Th>
                  <Th align="center">Weight (kg)</Th>
                  <Th align="center">Status</Th>
                  <Th align="center">Compliance</Th>
                  <Th align="center">QA Progress</Th>
                  <Th align="center">Release</Th>
                  <Th>Created</Th>
                  <Th align="center">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <Td>
                      <span className="font-mono text-sm font-medium text-gray-900">{batch.batch_id}</span>
                    </Td>
                    <Td>{batch.product_name ?? '-'}</Td>
                    <Td align="center">
                      {typeof batch.beef_weight_kg === 'number' ? batch.beef_weight_kg.toFixed(3) : '-'}
                    </Td>
                    <Td align="center">
                      {(() => {
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
                        return (
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badgeClass}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </Td>
                    <Td align="center">
                      <span className={`font-semibold ${getComplianceColor(batch.tolerance_compliance_percent)}`}>
                        {batch.tolerance_compliance_percent != null
                          ? `${batch.tolerance_compliance_percent}%`
                          : '-'}
                      </span>
                    </Td>
                    <Td align="center">
                      <div className="flex flex-col items-center text-sm text-gray-700">
                        <span>CP: {batch.qa_checkpoints_passed}/{batch.qa_checkpoints_total}</span>
                        <span>Doc: {batch.documents_approved}/{batch.documents_required}</span>
                      </div>
                    </Td>
                    <Td align="center">
                      <ReleaseStatusBadge status={batch.release_status} />
                    </Td>
                    <Td>
                      <div>{formatDate(batch.created_at)}</div>
                      <div className="text-xs text-gray-500">{batch.created_by ?? 'System'}</div>
                    </Td>
                    <Td align="center">
                      <div className="flex flex-wrap justify-center gap-2">
                        <button
                          onClick={() => router.push((`/batches/${batch.id}` as `/batches/${string}`) as Route)}
                          className="text-blue-600 hover:text-blue-900 inline-flex items-center gap-1"
                          title="View batch"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => router.push((`/qa/${batch.id}` as `/qa/${string}`) as Route)}
                          className="text-green-600 hover:text-green-900 inline-flex items-center gap-1"
                          title="QA checks"
                        >
                          <ClipboardCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBatch(batch);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-900 inline-flex items-center gap-1"
                          title="Delete batch"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
                {filteredBatches.length === 0 && (
                  <tr>
                    <td className="px-6 py-12 text-center text-gray-500" colSpan={9}>
                      No batches found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <th
      className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider`}
      style={{ textAlign: align }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" style={{ textAlign: align }}>
      {children}
    </td>
  );
}
