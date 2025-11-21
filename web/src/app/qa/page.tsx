'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardCheck,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Droplet,
} from 'lucide-react';
import type { Route } from 'next';
import type { ComplianceTaskWithStatus } from '@/types/compliance';
import { formatDate } from '@/lib/utils';

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

const COMPLIANCE_STATUS: Record<
  ComplianceTaskWithStatus['status'],
  { label: string; className: string }
> = {
  not_started: { label: 'Not started', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  on_track: { label: 'On track', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  due_soon: { label: 'Due soon', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700 border-red-200' },
  batch_due: { label: 'Due (batches)', className: 'bg-orange-100 text-orange-700 border-orange-200' },
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
  const [complianceTasks, setComplianceTasks] = useState<ComplianceTaskWithStatus[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(true);

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCompliance = async () => {
      try {
        setComplianceLoading(true);
        const res = await fetch('/api/compliance/tasks', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load compliance tasks');
        const data = (await res.json()) as { tasks: ComplianceTaskWithStatus[] };
        if (!cancelled) {
          setComplianceTasks(Array.isArray(data.tasks) ? data.tasks : []);
        }
      } catch (error) {
        console.error('Failed to load compliance summary', error);
        if (!cancelled) setComplianceTasks([]);
      } finally {
        if (!cancelled) setComplianceLoading(false);
      }
    };
    loadCompliance();
    return () => {
      cancelled = true;
    };
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

        <div className="mb-8 rounded-2xl border border-blue-100 bg-gradient-to-r from-sky-50 via-white to-emerald-50 p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white p-3 shadow-sm">
                <Droplet className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Water activity verification</p>
                <h2 className="text-lg font-semibold text-gray-900">Proof of drying method</h2>
                <p className="text-sm text-gray-600">
                  Review the documented time, temperature, and weight-loss data that delivered the 0.793 aw reading and 55% target.
                </p>
              </div>
            </div>
            <Link
              href="/qa/water-activity-proof"
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
            >
              View proof of method
            </Link>
          </div>
        </div>

        {/* General Compliance Snapshot */}
        <div className="bg-white border border-blue-100 rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">General compliance</p>
              <h2 className="text-xl font-semibold text-gray-900 mt-1">Listeria monitoring & microbiological verification</h2>
              <p className="text-sm text-gray-600">
                Weekly food-contact swabs, fortnightly non-contact swabs, and micro tests every 10 batches.
              </p>
            </div>
            <Link
              href="/qa/compliance"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Open compliance hub
            </Link>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {complianceLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="rounded-xl border border-gray-100 bg-gray-50 p-4 animate-pulse space-y-3">
                  <div className="h-4 w-2/3 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                  <div className="h-3 w-1/3 rounded bg-gray-200" />
                </div>
              ))
            ) : complianceTasks.length === 0 ? (
              <p className="text-sm text-gray-500 col-span-full">
                Configure compliance tasks in Supabase to begin tracking prerequisite programs.
              </p>
            ) : (
              complianceTasks.slice(0, 3).map((task) => {
                const status = COMPLIANCE_STATUS[task.status];
                return (
                  <div key={task.id} className="rounded-2xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{task.name}</p>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">{task.category}</p>
                    <div className="mt-3 space-y-1 text-sm text-gray-600">
                      <div>
                        <span className="font-medium text-gray-700">Last:</span>{' '}
                        {task.latest_log?.completed_at ? formatDate(task.latest_log.completed_at, true) : 'Not recorded'}
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">
                          {task.frequency_type === 'batch_interval' ? 'Batches since test:' : 'Next due:'}
                        </span>{' '}
                        {task.frequency_type === 'batch_interval'
                          ? `${task.batches_since_last ?? '–'}${typeof task.batches_remaining === 'number' ? ` (need ${Math.max(task.batches_remaining, 0)} more)` : ''}`
                          : task.next_due_at
                          ? formatDate(task.next_due_at, true)
                          : 'Set after first record'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
