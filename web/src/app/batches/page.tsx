// src/app/batches/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2, Eye, ClipboardCheck, FileDown, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
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
  const [releasing, setReleasing] = useState<Record<string, boolean>>({});
  const [releaseFlash, setReleaseFlash] = useState<Record<string, 'ok' | 'error' | undefined>>({});

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

  const handleCardExport = (batch: BatchSummary) => {
    router.push((`/batches/${batch.id}?export=1` as `/batches/${string}`) as Route);
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
    if (percent === null) return 'text-slate-400';
    if (percent >= 95) return 'text-emerald-200';
    if (percent >= 80) return 'text-amber-200';
    return 'text-rose-200';
  }

  function ReleaseStatusBadge({ status }: { status: BatchSummary['release_status'] }) {
    if (!status) return null;
    const colors = {
      approved: 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/30',
      pending: 'bg-amber-500/15 text-amber-100 border border-amber-400/30',
      hold: 'bg-orange-500/15 text-orange-100 border border-orange-400/30',
      rejected: 'bg-rose-500/15 text-rose-100 border border-rose-400/30',
      recalled: 'bg-purple-500/15 text-purple-100 border border-purple-400/30',
    } as const;
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${
          colors[status] ?? 'bg-white/10 text-slate-100 border border-white/10'
        }`}
      >
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

  const handleRelease = async (batch: BatchSummary) => {
    setReleasing((s) => ({ ...s, [batch.id]: true }));
    setReleaseFlash((f) => ({ ...f, [batch.id]: undefined }));
    try {
      const res = await fetch(`/api/batches/${batch.id}/release`, { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        status?: BatchSummary['status'];
        release_status?: BatchSummary['release_status'];
        release_number?: string | null;
      };
      if (!res.ok || body.ok !== true) {
        throw new Error(body.error ?? 'Failed to release batch');
      }
      await fetchBatches();
      setReleaseFlash((f) => ({ ...f, [batch.id]: 'ok' }));
      setTimeout(() => setReleaseFlash((f) => ({ ...f, [batch.id]: undefined })), 1500);
    } catch (err) {
      console.error(err);
      setReleaseFlash((f) => ({ ...f, [batch.id]: 'error' }));
    } finally {
      setReleasing((s) => ({ ...s, [batch.id]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 shadow-lg shadow-black/40 backdrop-blur">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-emerald-400" />
          <span className="text-sm font-semibold tracking-wide text-emerald-100">Loading batches</span>
        </div>
      </div>
    );
  }

  const total = batches.length;
  const inProgress = batches.filter((b) => getDerivedStatus(b) === 'in_progress').length;
  const completed = batches.filter((b) => getDerivedStatus(b) === 'completed').length;
  const released = batches.filter((b) => b.release_status === 'approved').length;

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black text-slate-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute right-0 top-32 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 p-[1px] shadow-2xl shadow-indigo-900/30">
          <div className="relative rounded-[calc(1.5rem-1px)] bg-slate-950/85 px-6 py-6 sm:px-10 sm:py-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-indigo-100">Operations Control</p>
                <h1 className="text-3xl font-semibold text-white sm:text-4xl">Batch history & release</h1>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">
                  Track QA progress, tweak best before dates, and release finished batches with modern, glassy controls.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-slate-100">
                  {released} released
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-slate-100">
                  {inProgress} active
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <label className="block text-sm font-medium text-slate-200">Search</label>
            <input
              type="text"
              placeholder="Search batch ID, product, or operator..."
              value={searchRaw}
              onChange={(e) => setSearchRaw(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
              inputMode="search"
            />
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <label className="block text-sm font-medium text-slate-200">Filter Status</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
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
              className="w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 px-6 py-2.5 text-center text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/20 transition hover:shadow-emerald-500/30"
            >
              + New Batch
            </Link>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Batches" value={total} />
          <StatCard label="In Progress" value={inProgress} accent="text-amber-200" />
          <StatCard label="Completed" value={completed} accent="text-sky-200" />
          <StatCard label="Released" value={released} accent="text-emerald-200" />
        </div>

        {filteredBatches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-slate-400">
            No batches found.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredBatches.map((batch) => {
              const summary = qaStages[batch.id];
              const derivedStatus = getDerivedStatus(batch);
              const bestBeforeValue = bestBeforeDrafts[batch.id] ?? '';
              const qaPercent = Math.min(100, Math.max(0, summary?.percent ?? 0));
              const modernStageTone: Partial<Record<Stage, string>> = {
                preparation: 'bg-slate-500/15 text-slate-100 border border-slate-400/30',
                mixing: 'bg-sky-500/15 text-sky-100 border border-sky-400/30',
                marination: 'bg-amber-500/15 text-amber-100 border border-amber-400/30',
                drying: 'bg-orange-500/15 text-orange-100 border border-orange-400/30',
                packaging: 'bg-indigo-500/15 text-indigo-100 border border-indigo-400/30',
                final: 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/30',
              };
              const label = summary?.label ?? formatStatusLabel(derivedStatus);
              const badgeClass =
                summary?.completed
                  ? 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/30'
                  : summary?.stage
                  ? modernStageTone[summary.stage] ?? 'bg-white/10 text-slate-100 border border-white/15'
                  : derivedStatus === 'released'
                  ? 'bg-indigo-500/15 text-indigo-100 border border-indigo-400/30'
                  : derivedStatus === 'completed'
                  ? 'bg-emerald-500/15 text-emerald-100 border border-emerald-400/30'
                  : 'bg-amber-500/15 text-amber-100 border border-amber-400/30';
              const releaseLocked = batch.release_status === 'approved';
              const releaseBusy = releasing[batch.id];
              const releaseEligible =
                !releaseLocked &&
                (summary?.completed || derivedStatus === 'completed' || qaPercent >= 95);
              const releaseState = releaseFlash[batch.id];
              return (
                <div
                  key={batch.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/30 backdrop-blur"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-emerald-500/10 opacity-0 transition group-hover:opacity-100" />
                  <div className="relative flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wide text-emerald-200">
                        {batch.batch_id}
                        {batch.release_status ? <ReleaseStatusBadge status={batch.release_status} /> : null}
                      </p>
                      <p className="text-lg font-semibold text-white">{batch.product_name ?? '-'}</p>
                      <p className="text-xs text-slate-400">
                        Created {formatDate(batch.created_at)}
                        {batch.created_by ? ` - ${batch.created_by}` : ''}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{label}</span>
                  </div>

                  <div className="relative mt-4 grid grid-cols-2 gap-4 text-sm text-slate-200">
                    <div className="space-y-2">
                      <p className="text-xs uppercase text-slate-400">QA Progress</p>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">
                          CP {batch.qa_checkpoints_passed}/{batch.qa_checkpoints_total}
                        </span>
                        <span className="text-xs text-slate-400">
                          Doc {batch.documents_approved}/{batch.documents_required}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400 transition-all"
                          style={{ width: `${qaPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        <span>{summary?.checkpoint ?? summary?.label ?? label}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs uppercase text-slate-400">Weight</p>
                      <p className="text-base font-semibold text-white">
                        {typeof batch.beef_weight_kg === 'number' ? `${batch.beef_weight_kg.toFixed(3)} kg` : '-'}
                      </p>
                      <p className="text-xs uppercase text-slate-400">Compliance</p>
                      <p className={`text-lg font-semibold ${getComplianceColor(batch.tolerance_compliance_percent)}`}>
                        {batch.tolerance_compliance_percent != null ? `${batch.tolerance_compliance_percent}%` : '-'}
                      </p>
                      <p className="text-xs uppercase text-slate-400">Release</p>
                      <div className="flex items-center gap-2">
                        <ReleaseStatusBadge status={batch.release_status} />
                        {releaseState === 'ok' && <span className="text-xs text-emerald-200">Released</span>}
                        {releaseState === 'error' && <span className="text-xs text-rose-200">Failed to release</span>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-50">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Best before</p>
                      <span className="text-xs text-emerald-200">{bestBeforeText(batch)}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <input
                        type="date"
                        value={bestBeforeValue}
                        onChange={(e) =>
                          setBestBeforeDrafts((d) => ({
                            ...d,
                            [batch.id]: e.target.value,
                          }))
                        }
                        className="flex-1 rounded-lg border border-emerald-500/30 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                      />
                      <button
                        type="button"
                        onClick={() => void handleBestBeforeSave(batch)}
                        disabled={bestBeforeSaving[batch.id]}
                        className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 px-3 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 disabled:opacity-60"
                      >
                        {bestBeforeSaving[batch.id] ? 'Saving...' : 'Save date'}
                      </button>
                    </div>
                    {bestBeforeFlash[batch.id] === 'saved' && (
                      <p className="mt-2 text-xs font-semibold text-emerald-200">Saved</p>
                    )}
                    {bestBeforeFlash[batch.id] === 'error' && (
                      <p className="mt-2 text-xs font-semibold text-rose-200">Failed to save. Try again.</p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleCardExport(batch)}
                      className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-white/20"
                    >
                      <FileDown className="h-4 w-4" />
                      Export PDF
                    </button>
                    <button
                      onClick={() => router.push((`/batches/${batch.id}` as `/batches/${string}`) as Route)}
                      className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-white/20"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                    <button
                      onClick={() => router.push((`/qa/${batch.id}` as `/qa/${string}`) as Route)}
                      className="flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 px-3 py-2 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/20 transition hover:shadow-emerald-500/30"
                    >
                      <ClipboardCheck className="h-4 w-4" />
                      QA
                    </button>
                    <button
                      onClick={() => void handleRelease(batch)}
                      disabled={releaseLocked || releaseBusy || !releaseEligible}
                      className={`flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        releaseLocked
                          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                          : releaseEligible
                          ? 'border-emerald-400/50 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-900 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30'
                          : 'border-white/10 bg-white/5 text-slate-400'
                      } disabled:opacity-60`}
                      title={releaseEligible ? 'Mark batch as released' : 'Finish QA to release'}
                    >
                      {releaseBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {releaseLocked ? 'Released' : releaseBusy ? 'Releasing...' : 'Release'}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBatch(batch);
                        setShowDeleteModal(true);
                      }}
                      className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-300/50"
                    >
                      <Trash2 className="h-4 w-4" />
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

function StatCard({ label, value, accent = 'text-white' }: { label: string; value: number; accent?: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30 backdrop-blur">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/10 opacity-0 transition group-hover:opacity-100" />
      <div className="relative flex items-center justify-between">
        <div>
          <div className={`text-3xl font-semibold ${accent}`}>{value}</div>
          <div className="text-sm text-slate-300">{label}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-slate-200">
          <CheckCircle2 className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
