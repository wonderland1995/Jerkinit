// src/app/batches/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2, Eye, ClipboardCheck } from 'lucide-react';
import DeleteBatchModal from '@/components/DeleteBatchModal';
import type { Route } from 'next';

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

export default function BatchHistoryPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'in_progress' | 'completed' | 'released'>('all');
  const [searchRaw, setSearchRaw] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchSummary | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchRaw.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchRaw]);

  useEffect(() => {
    fetchBatches();
  }, []);

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

  const filteredBatches = useMemo(() => {
    return batches.filter((batch) => {
      if (filter === 'in_progress' && batch.status !== 'in_progress') return false;
      if (filter === 'completed' && batch.status !== 'completed') return false;
      if (filter === 'released' && batch.release_status !== 'approved') return false;

      if (searchTerm) {
        return (
          batch.batch_id.toLowerCase().includes(searchTerm) ||
          (batch.product_name ?? '').toLowerCase().includes(searchTerm) ||
          (batch.created_by ?? '').toLowerCase().includes(searchTerm)
        );
      }
      return true;
    });
  }, [batches, filter, searchTerm]);

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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const total = batches.length;
  const inProgress = batches.filter((b) => b.status === 'in_progress').length;
  const completed = batches.filter((b) => b.status === 'completed').length;
  const released = batches.filter((b) => b.release_status === 'approved').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Batch History</h1>
          <p className="mt-2 text-gray-600">View all production batches and their QA status</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search batch ID, product, or operator..."
                value={searchRaw}
                onChange={(e) => setSearchRaw(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                inputMode="search"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Filter Status</label>
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Batches" value={total} />
          <StatCard label="In Progress" value={inProgress} accent="text-yellow-600" />
          <StatCard label="Completed" value={completed} accent="text-blue-600" />
          <StatCard label="Released" value={released} accent="text-green-600" />
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
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
                    <Td>{batch.product_name ?? '—'}</Td>
                    <Td align="center">
                      {typeof batch.beef_weight_kg === 'number' ? batch.beef_weight_kg.toFixed(3) : '—'}
                    </Td>
                    <Td align="center">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          batch.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : batch.status === 'released'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {batch.status.replace('_', ' ')}
                      </span>
                    </Td>
                    <Td align="center">
                      <span className={`font-semibold ${getComplianceColor(batch.tolerance_compliance_percent)}`}>
                        {batch.tolerance_compliance_percent !== null
                          ? `${batch.tolerance_compliance_percent}%`
                          : '—'}
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
                      <div>{new Date(batch.created_at).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-500">{batch.created_by ?? 'System'}</div>
                    </Td>
                    <Td align="center">
                      <div className="flex justify-center gap-2">
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
          batchId={selectedBatch.id}
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