'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck, Search, Filter, Calendar, TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import type { Route } from 'next';

interface Batch {
  id: string;
  batch_id: string;
  status: string;
  created_at: string;
  product?: {
    name: string;
  };
}

interface QAStats {
  total_batches: number;
  pending_qa: number;
  completed_qa: number;
  failed_checks: number;
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
  preparation: 'bg-slate-100 text-slate-700 border-slate-200',
  mixing: 'bg-blue-100 text-blue-700 border-blue-200',
  marination: 'bg-amber-100 text-amber-700 border-amber-200',
  drying: 'bg-orange-100 text-orange-700 border-orange-200',
  packaging: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  final: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

interface BatchQaProgress {
  current_stage: Stage;
  percent_complete: number;
  current_checkpoint?: { code?: string | null; name?: string | null } | null;
}

export default function QAPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/batches/history?limit=50');
      const data = await res.json();
      setBatches(data.batches || []);
    } catch (error) {
      console.error('Failed to fetch batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = batch.batch_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         batch.product?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || batch.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats: QAStats = {
    total_batches: batches.length,
    pending_qa: batches.filter(b => b.status === 'in_progress').length,
    completed_qa: batches.filter(b => b.status === 'completed').length,
    failed_checks: 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading QA data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                <ClipboardCheck className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">QA Management</h1>
                <p className="text-gray-600 mt-1">FSANZ compliant quality assurance tracking</p>
              </div>
            </div>
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={ClipboardCheck}
            label="Total Batches"
            value={stats.total_batches}
            color="blue"
          />
          <StatCard
            icon={Clock}
            label="Pending QA"
            value={stats.pending_qa}
            color="amber"
          />
          <StatCard
            icon={CheckCircle2}
            label="Completed QA"
            value={stats.completed_qa}
            color="green"
          />
          <StatCard
            icon={AlertCircle}
            label="Failed Checks"
            value={stats.failed_checks}
            color="red"
          />
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Batches
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by batch ID or product name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                >
                  <option value="all">All Batches</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Batches Grid */}
        {filteredBatches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-4">No batches found</p>
            <Link
              href="/recipe/new"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Create First Batch
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBatches.map((batch) => (
              <BatchCard key={batch.id} batch={batch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: 'blue' | 'amber' | 'green' | 'red';
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    amber: 'from-amber-500 to-amber-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      <h3 className="text-sm font-medium text-gray-600 mb-1">{label}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

interface BatchCardProps {
  batch: Batch;
}

function BatchCard({ batch }: BatchCardProps) {
  const [qaProgress, setQaProgress] = useState<{
    label: string;
    className: string;
    percent: number;
    checkpoint: string | null;
    completed: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadProgress = async () => {
      try {
        const res = await fetch(`/api/batches/${batch.id}/qa/progress`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as BatchQaProgress;
        if (cancelled) return;

        const rawPercent = typeof data.percent_complete === 'number'
          ? data.percent_complete
          : Number(data.percent_complete ?? 0);
        const percent = Number.isFinite(rawPercent) ? rawPercent : 0;
        const stage = (data.current_stage ?? 'preparation') as Stage;
        const completed = percent >= 100 || stage === 'final';
        const checkpointParts = data.current_checkpoint
          ? [data.current_checkpoint.code, data.current_checkpoint.name].filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
          : [];
        const checkpoint = checkpointParts.length > 0 ? checkpointParts.join(' - ') : null;
        const label = completed
          ? 'QA Complete'
          : checkpoint ?? (STAGE_LABELS[stage] ?? 'QA in progress');
        const className = completed
          ? 'bg-green-100 text-green-800 border-green-200'
          : stage
          ? STAGE_BADGE_CLASSES[stage] ?? 'bg-gray-100 text-gray-800 border-gray-200'
          : 'bg-gray-100 text-gray-800 border-gray-200';

        setQaProgress({ label, className, percent, checkpoint, completed });
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to load QA progress for batch', batch.id, err);
        }
      }
    };

    loadProgress();
    return () => {
      cancelled = true;
    };
  }, [batch.id]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'in_progress':
        return <Clock className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const badgeClass = qaProgress ? qaProgress.className : getStatusColor(batch.status);
  const badgeIcon = qaProgress
    ? qaProgress.completed
      ? <CheckCircle2 className="w-4 h-4" />
      : <Clock className="w-4 h-4" />
    : getStatusIcon(batch.status);
  const badgeLabel = qaProgress ? (qaProgress.completed ? 'QA COMPLETE' : qaProgress.checkpoint ?? qaProgress.label) : batch.status.replace('_', ' ').toUpperCase();
  const percentLabel = qaProgress ? `${Math.round(qaProgress.percent)}%` : '--';

  return (
    <Link
      href={`/qa/${batch.id}` as Route}
      className="block group"
    >
      <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all p-6">
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${badgeClass}`}>
            {badgeIcon}
            {badgeLabel}
          </span>
          <Calendar className="w-4 h-4 text-gray-400" />
        </div>

        {/* Batch ID */}
        <h3 className="font-mono text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition">
          {batch.batch_id}
        </h3>

        {/* Product Name */}
        <p className="text-sm text-gray-600">
          {batch.product?.name || 'Unknown Product'}
        </p>

        <div className="mt-3 mb-4 space-y-1 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700">QA Progress</span>
            <span className="font-mono text-gray-900">{percentLabel}</span>
          </div>
          {qaProgress?.checkpoint && !qaProgress.completed && (
            <div className="text-xs text-gray-500">
              Next: {qaProgress.checkpoint}
            </div>
          )}
        </div>

        {/* Date */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100">
          <span>Created</span>
          <span className="font-medium">
            {new Date(batch.created_at).toLocaleDateString('en-AU')}
          </span>
        </div>

        {/* Hover Arrow */}
        <div className="mt-4 flex items-center justify-end text-blue-600 opacity-0 group-hover:opacity-100 transition">
          <span className="text-sm font-medium mr-1">Open QA Checks</span>
          <TrendingUp className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
