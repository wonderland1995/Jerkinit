'use client';

import { useEffect, useMemo, useState } from 'react';
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
  FlaskConical,
  Sparkles,
  X,
} from 'lucide-react';
import type { Route } from 'next';
import type { ComplianceTaskWithStatus } from '@/types/compliance';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useToast } from '@/components/ToastProvider';
import {
  addMonths,
  fridayDateFromCreatedAt,
  generateBatchQaAutofill,
  LAB_CADENCE_MONTHS,
  sumRecipeWetWeightKg,
} from '@/lib/autofillDefaults';

interface Batch {
  id: string;
  batch_id: string;
  status: string;
  created_at: string;
  product?: {
    name: string;
  };
}

const BULK_QA_CODES = new Set([
  'DRY-PREHEAT',
  'MIX-INGR',
  'MAR-FSP-SALT',
  'MAR-FSP-TIME',
  'DRY-FSP-OVEN',
  'DRY-FSP-CORE',
  'DRY-FSP-AW-LAB',
]);

interface QAStats {
  total_batches: number;
  pending_qa: number;
  completed_qa: number;
  failed_checks: number;
}

type LabAwCheck = {
  id: string;
  batch_id: string;
  batch_code: string | null;
  status: string | null;
  sent_at: string | null;
  result_at: string | null;
  water_activity: number | null;
  sample_id: string | null;
};

type LabSummary = {
  lastEventAt: string | null;
  lastBatchCode: string | null;
  lastBatchId: string | null;
  lastAw: number | null;
  nextDueAt: string | null;
  awaitingResult: boolean;
};

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
  const toast = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_progress' | 'completed'>('all');
  const [complianceTasks, setComplianceTasks] = useState<ComplianceTaskWithStatus[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(true);
  const [labSummary, setLabSummary] = useState<LabSummary | null>(null);
  const [labLoading, setLabLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkOperator, setBulkOperator] = useState('');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');

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

  useEffect(() => {
    let cancelled = false;
    const loadLab = async () => {
      try {
        setLabLoading(true);
        const res = await fetch('/api/qa/audit/aw', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load lab summary');
        const data = (await res.json()) as { awChecks?: LabAwCheck[] };
        const checks = Array.isArray(data.awChecks) ? data.awChecks : [];
        const dated = checks
          .map((c) => {
            const eventAt = c.result_at || c.sent_at;
            return eventAt ? { ...c, eventAt } : null;
          })
          .filter((c): c is LabAwCheck & { eventAt: string } => Boolean(c))
          .sort((a, b) => Date.parse(b.eventAt) - Date.parse(a.eventAt));

        const latest = dated[0] ?? null;
        if (!cancelled) {
          if (!latest) {
            setLabSummary({
              lastEventAt: null,
              lastBatchCode: null,
              lastBatchId: null,
              lastAw: null,
              nextDueAt: null,
              awaitingResult: false,
            });
          } else {
            const nextDue = addMonths(latest.eventAt, LAB_CADENCE_MONTHS);
            setLabSummary({
              lastEventAt: latest.eventAt,
              lastBatchCode: latest.batch_code,
              lastBatchId: latest.batch_id,
              lastAw: latest.water_activity,
              nextDueAt: nextDue.toISOString(),
              awaitingResult: Boolean(latest.sent_at) && !latest.result_at && latest.water_activity == null,
            });
          }
        }
      } catch (error) {
        console.error('Failed to load lab cadence summary', error);
        if (!cancelled) setLabSummary(null);
      } finally {
        if (!cancelled) setLabLoading(false);
      }
    };
    loadLab();
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

  const selectedBatches = useMemo(
    () => filteredBatches.filter((b) => selectedIds.has(b.id)),
    [filteredBatches, selectedIds],
  );

  const allFilteredSelected =
    filteredBatches.length > 0 && filteredBatches.every((b) => selectedIds.has(b.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const b of filteredBatches) next.delete(b.id);
      } else {
        for (const b of filteredBatches) next.add(b.id);
      }
      return next;
    });
  };

  const runBulkComplete = async () => {
    if (selectedBatches.length === 0) {
      toast.error('Select at least one batch.');
      return;
    }
    if (!bulkOperator.trim()) {
      toast.error('Operator name is required.');
      return;
    }

    setBulkRunning(true);
    setBulkProgress('Loading checkpoints...');
    try {
      const cpRes = await fetch('/api/qa/checkpoints', { cache: 'no-store' });
      if (!cpRes.ok) throw new Error('Failed to load QA checkpoints');
      const cpJson = (await cpRes.json()) as {
        checkpoints?: Array<{ id: string; code: string; name: string; active?: boolean }>;
      };
      const checkpoints = (cpJson.checkpoints ?? []).filter(
        (c) => c.active !== false && BULK_QA_CODES.has(c.code),
      );
      if (checkpoints.length === 0) throw new Error('No active jerky QA checkpoints found.');

      let ok = 0;
      const failures: string[] = [];

      for (let i = 0; i < selectedBatches.length; i++) {
        const batch = selectedBatches[i];
        setBulkProgress(`Completing ${batch.batch_id} (${i + 1}/${selectedBatches.length})...`);
        try {
          const batchRes = await fetch(`/api/batches/${batch.id}`, { cache: 'no-store' });
          if (!batchRes.ok) throw new Error('Failed to load batch details');
          const batchJson = (await batchRes.json()) as {
            batch?: {
              beef_weight_kg?: number | null;
              ingredients?: Array<{
                actual_amount?: number | null;
                target_amount?: number | null;
                unit?: string | null;
              }>;
            } | null;
          };
          const detail = batchJson.batch;
          const wetKg = sumRecipeWetWeightKg(detail?.beef_weight_kg, detail?.ingredients ?? []);
          const fridayDate = fridayDateFromCreatedAt(batch.created_at);
          const result = generateBatchQaAutofill({
            operatorName: bulkOperator.trim(),
            fridayDate,
            wetWeightKg: wetKg > 0 ? wetKg : 17,
          });

          await Promise.all(
            checkpoints.map(async (cp) => {
              const payload = result.byCode[cp.code] ?? {
                status: 'passed' as const,
                checked_by: result.completed_by,
                checked_at: result.completed_at.length >= 16 ? `${result.completed_at.slice(0, 16)}:00` : null,
                notes: `${cp.name} marked passed by ${result.completed_by}.`,
              };
              const res = await fetch('/api/qa/checkpoint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  batch_id: batch.id,
                  checkpoint_id: cp.id,
                  ...payload,
                  checked_by: result.completed_by,
                }),
              });
              if (!res.ok) {
                const body = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(body.error ?? `Failed on ${cp.code}`);
              }
            }),
          );
          ok += 1;
        } catch (err) {
          console.error('Bulk QA failed for', batch.batch_id, err);
          failures.push(batch.batch_id);
        }
      }

      if (ok > 0) {
        toast.success(
          `Completed QA for ${ok} batch${ok === 1 ? '' : 'es'} using each created-date weekend schedule.`,
        );
      }
      if (failures.length > 0) {
        toast.error(`Failed: ${failures.join(', ')}`);
      }

      setSelectedIds(new Set());
      setBulkOpen(false);
      setBulkOperator('');
      setLoading(true);
      await fetchBatches();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulk QA complete failed.');
    } finally {
      setBulkRunning(false);
      setBulkProgress('');
    }
  };

  const stats: QAStats = {
    total_batches: batches.length,
    pending_qa: batches.filter(b => b.status === 'in_progress').length,
    completed_qa: batches.filter(b => b.status === 'completed').length,
    failed_checks: 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-3 shadow-lg">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-emerald-500" />
          <span className="text-sm font-semibold text-emerald-700">Loading QA data</span>
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
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <ClipboardCheck className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">QA Management</h1>
                <p className="text-gray-500 mt-1">FSANZ compliant quality assurance tracking</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/qa/audit"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
              >
                Audit mode
              </Link>
            </div>
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
            color="green"
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
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Water activity verification</p>
                <h2 className="text-lg font-semibold text-gray-900">Proof of drying method</h2>
                <p className="text-sm text-gray-600">
                  Review the documented time, temperature, and weight-loss data that delivered the 0.793 aw reading and 55% target.
                </p>
              </div>
            </div>
            <Link
              href="/qa/water-activity-proof"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700"
            >
              View proof of method
            </Link>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
                <FlaskConical className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">External lab cadence</p>
                <h2 className="text-lg font-semibold text-gray-900">Send a batch to the lab every {LAB_CADENCE_MONTHS} months</h2>
                <p className="text-sm text-gray-600">
                  Open a jerky batch QA page to mark it sent, then upload the lab certificate when it returns.
                </p>
                {labLoading ? (
                  <p className="mt-3 text-sm text-gray-500">Loading lab status...</p>
                ) : labSummary?.lastEventAt ? (
                  <div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Last lab activity</p>
                      <p className="font-medium">{formatDateTime(labSummary.lastEventAt)}</p>
                      <p className="text-xs text-gray-500">
                        Batch {labSummary.lastBatchCode ?? '—'}
                        {labSummary.lastAw != null ? ` · Aw ${labSummary.lastAw}` : ''}
                        {labSummary.awaitingResult ? ' · awaiting result' : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Next due</p>
                      <p className="font-medium">
                        {labSummary.nextDueAt ? formatDate(labSummary.nextDueAt, true) : '—'}
                      </p>
                      {labSummary.nextDueAt && Date.parse(labSummary.nextDueAt) < Date.now() && (
                        <p className="text-xs font-semibold text-amber-700">Overdue</p>
                      )}
                    </div>
                    <div className="flex items-end">
                      {labSummary.lastBatchId && (
                        <Link
                          href={`/qa/${labSummary.lastBatchId}` as Route}
                          className="text-sm font-semibold text-indigo-700 hover:text-indigo-800"
                        >
                          Open last lab batch →
                        </Link>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">
                    No lab submissions yet. Open any in-progress batch and use Send to lab.
                  </p>
                )}
              </div>
            </div>
            <Link
              href="/qa/audit"
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
            >
              View lab audit
            </Link>
          </div>
        </div>

        {/* General Compliance Snapshot */}
        <div className="bg-white border border-blue-100 rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">General compliance</p>
              <h2 className="text-xl font-semibold text-gray-900 mt-1">Listeria monitoring & microbiological verification</h2>
              <p className="text-sm text-gray-600">
                Weekly food-contact swabs, fortnightly non-contact swabs, and micro tests every 10 batches.
              </p>
            </div>
            <Link
              href="/qa/compliance"
              className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400"
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 appearance-none"
                >
                  <option value="all">All Batches</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleSelectAllFiltered}
                className="h-4 w-4 rounded border-gray-300 text-blue-600"
              />
              Select all shown ({filteredBatches.length})
            </label>
            <p className="text-xs text-gray-500">
              Bulk complete uses each batch&apos;s <span className="font-medium">created</span> date to
              set Fri→Sun production times.
            </p>
          </div>
        </div>

        {/* Batches Grid */}
        {filteredBatches.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
            <ClipboardCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg mb-4">No batches found</p>
            <Link
              href="/recipe/new"
              className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition"
            >
              Create first batch
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
            {filteredBatches.map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                selected={selectedIds.has(batch.id)}
                onToggleSelect={() => toggleSelect(batch.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-800">
              {selectedIds.size} batch{selectedIds.size === 1 ? '' : 'es'} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Sparkles className="h-4 w-4" />
                Complete QA for selected
              </button>
            </div>
          </div>
        </div>
      )}

      {bulkOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !bulkRunning && setBulkOpen(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <button
                type="button"
                disabled={bulkRunning}
                onClick={() => setBulkOpen(false)}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-center text-xl font-semibold text-gray-900">
                Complete QA for {selectedBatches.length} batch
                {selectedBatches.length === 1 ? '' : 'es'}
              </h3>
              <p className="mt-2 text-center text-sm text-gray-600">
                Each batch is filled using its <span className="font-medium">created</span> date as the
                production Friday (Fri marinate → Sat dry → Sun unload).
              </p>

              <div className="mt-4 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm">
                {selectedBatches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold text-gray-900">{b.batch_id}</span>
                    <span className="text-xs text-gray-500">
                      Created {new Date(b.created_at).toLocaleDateString('en-AU')} → Fri{' '}
                      {fridayDateFromCreatedAt(b.created_at)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Operator name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bulkOperator}
                  onChange={(e) => setBulkOperator(e.target.value)}
                  disabled={bulkRunning}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Operator name"
                />
              </div>

              {bulkProgress && (
                <p className="mt-3 text-sm text-blue-700">{bulkProgress}</p>
              )}

              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  disabled={bulkRunning}
                  onClick={() => setBulkOpen(false)}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkRunning}
                  onClick={() => void runBulkComplete()}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {bulkRunning ? 'Working...' : 'Complete selected'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
    blue: 'from-sky-500 to-sky-600',
    amber: 'from-amber-500 to-amber-600',
    green: 'from-emerald-500 to-teal-600',
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
  selected: boolean;
  onToggleSelect: () => void;
}

function BatchCard({ batch, selected, onToggleSelect }: BatchCardProps) {
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
  const productionFriday = fridayDateFromCreatedAt(batch.created_at);

  return (
    <div
      className={`relative rounded-2xl border-2 bg-white p-6 shadow-sm transition-all hover:shadow-lg ${
        selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-emerald-300'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <label
          className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-gray-300 text-blue-600"
          />
          Select
        </label>
        <span className="text-[11px] text-gray-500">
          Prod Fri {productionFriday}
        </span>
      </div>

      <Link href={`/qa/${batch.id}` as Route} className="block group">
        <div className="flex items-center justify-between mb-4">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${badgeClass}`}>
            {badgeIcon}
            {badgeLabel}
          </span>
          <Calendar className="w-4 h-4 text-gray-400" />
        </div>

        <h3 className="font-mono text-lg font-bold text-gray-900 mb-2 group-hover:text-emerald-600 transition">
          {batch.batch_id}
        </h3>

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

        <div className="flex items-center justify-between text-xs text-gray-500 pt-4 border-t border-gray-100">
          <span>Created</span>
          <span className="font-medium">
            {new Date(batch.created_at).toLocaleDateString('en-AU')}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-end text-emerald-600 opacity-0 group-hover:opacity-100 transition">
          <span className="text-sm font-medium mr-1">Open QA Checks</span>
          <TrendingUp className="w-4 h-4" />
        </div>
      </Link>
    </div>
  );
}
