'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivitySquare,
  AlertCircle,
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  Flag,
  Info,
  Printer,
  ShieldCheck,
  ThermometerSun,
} from 'lucide-react';
import type { ComplianceTaskWithStatus } from '@/types/compliance';

type DashboardStats = {
  total_batches?: number;
  in_progress?: number;
  completed?: number;
  released?: number;
};

type ComplianceRecord = {
  batch_id: string | number;
  batch_number?: string | null;
  product_name?: string | null;
  batch_status?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
  required_checkpoints?: number | null;
  passed_checkpoints?: number | null;
  required_documents?: number | null;
  approved_documents?: number | null;
  release_status?: string | null;
  release_number?: string | null;
};

type Recall = {
  id: string;
  reason?: string | null;
  notes?: string | null;
  initiated_at?: string | null;
  initiated_by?: string | null;
  status?: string | null;
  lot?: {
    lot_number?: string | null;
    internal_lot_code?: string | null;
    status?: string | null;
    material_name?: string | null;
  } | null;
  batches: Array<{
    id: string;
    batch_id: string;
    status?: string | null;
    release_status?: string | null;
    product_name?: string | null;
  }>;
};

type AwCheck = {
  id: string;
  batch_id: string;
  batch_code: string | null;
  status: string | null;
  checked_at: string | null;
  checked_by: string | null;
  water_activity: number | null;
  sample_id: string | null;
  lab_name: string | null;
  sent_at: string | null;
  result_at: string | null;
  notes: string | null;
};

type AwDocument = {
  id: string;
  batch_id: string;
  file_url: string | null;
  file_name: string | null;
  document_number: string | null;
  status: string | null;
  uploaded_at: string | null;
  document_type?: { code?: string | null; name?: string | null } | null;
  notes?: string | null;
};

type AuditAwResponse = {
  awChecks: AwCheck[];
  documents: AwDocument[];
};

type AuditState = {
  stats: DashboardStats | null;
  tasks: ComplianceTaskWithStatus[];
  complianceRecords: ComplianceRecord[];
  recalls: Recall[];
  awChecks: AwCheck[];
  awDocuments: AwDocument[];
};

const statusTone: Record<string, string> = {
  overdue: 'bg-red-100 text-red-800 border-red-200',
  due_soon: 'bg-amber-100 text-amber-800 border-amber-200',
  batch_due: 'bg-orange-100 text-orange-800 border-orange-200',
  on_track: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  not_started: 'bg-slate-100 text-slate-700 border-slate-200',
};

const riskOrder: Record<string, number> = {
  overdue: 0,
  batch_due: 1,
  due_soon: 2,
  on_track: 3,
  not_started: 4,
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const percent = (num?: number | null, den?: number | null) => {
  if (!den || den <= 0 || num == null) return null;
  return Math.round((num / den) * 100);
};

export default function AuditSnapshotPage() {
  const [data, setData] = useState<AuditState>({
    stats: null,
    tasks: [],
    complianceRecords: [],
    recalls: [],
    awChecks: [],
    awDocuments: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsRes, tasksRes, complianceRes, recallsRes, awRes] = await Promise.all([
          fetch('/api/dashboard/stats', { cache: 'no-store' }),
          fetch('/api/compliance/tasks', { cache: 'no-store' }),
          fetch('/api/reports/compliance', { cache: 'no-store' }),
          fetch('/api/recalls', { cache: 'no-store' }),
          fetch('/api/qa/audit/aw', { cache: 'no-store' }),
        ]);

        const stats = statsRes.ok ? ((await statsRes.json()) as DashboardStats) : null;
        const tasksBody = tasksRes.ok
          ? ((await tasksRes.json()) as { tasks: ComplianceTaskWithStatus[] })
          : { tasks: [] };
        const complianceBody = complianceRes.ok
          ? ((await complianceRes.json()) as { records?: ComplianceRecord[] })
          : { records: [] };
        const recallBody = recallsRes.ok ? ((await recallsRes.json()) as { recalls?: Recall[] }) : { recalls: [] };
        const awBody = awRes.ok ? ((await awRes.json()) as AuditAwResponse) : { awChecks: [], documents: [] };

        if (cancelled) return;
        setData({
          stats: stats ?? null,
          tasks: Array.isArray(tasksBody.tasks) ? tasksBody.tasks : [],
          complianceRecords: Array.isArray(complianceBody.records) ? complianceBody.records : [],
          recalls: Array.isArray(recallBody.recalls) ? recallBody.recalls : [],
          awChecks: Array.isArray(awBody.awChecks) ? awBody.awChecks : [],
          awDocuments: Array.isArray(awBody.documents) ? awBody.documents : [],
        });
      } catch (err) {
        console.error('Failed to load audit data', err);
        if (!cancelled) {
          setError('Unable to load audit snapshot right now.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const complianceDue = useMemo(
    () =>
      data.tasks.filter((task) =>
        ['overdue', 'due_soon', 'batch_due'].includes(task.status),
      ),
    [data.tasks],
  );

  const topCompliance = useMemo(
    () =>
      [...data.tasks]
        .sort((a, b) => riskOrder[a.status] - riskOrder[b.status])
        .slice(0, 5),
    [data.tasks],
  );

  const recentBatches = useMemo(
    () => (data.complianceRecords ?? []).slice(0, 6),
    [data.complianceRecords],
  );

  const latestAw = data.awChecks[0] ?? null;

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 print-content">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Audit mode</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">Audit-ready snapshot</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                <ShieldCheck className="h-4 w-4" />
                Live data
              </span>
            </div>
            <p className="text-sm text-slate-600">
              Current QA evidence, water activity verification, recalls, and prerequisite programs pulled directly from the system.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-end no-print">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              Print audit PDF
            </button>
            <Link
              href="/qa/compliance"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <BookOpenCheck className="h-4 w-4" />
              Compliance hub
            </Link>
            <Link
              href="/qa"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              <ArrowUpRight className="h-4 w-4" />
              QA home
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="h-28 animate-pulse rounded-2xl border border-slate-100 bg-white" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            {error}
          </div>
        ) : (
          <div className="space-y-8 pt-6">
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="QA batches"
                value={data.stats?.total_batches ?? 0}
                helper="Total batches in system"
                icon={<ActivitySquare className="h-5 w-5" />}
              />
              <StatCard
                label="QA in progress"
                value={data.stats?.in_progress ?? 0}
                helper="Batches with open QA"
                icon={<ThermometerSun className="h-5 w-5" />}
              />
              <StatCard
                label="QA completed"
                value={data.stats?.completed ?? 0}
                helper="Batches closed"
                icon={<CheckCircle2 className="h-5 w-5" />}
              />
              <StatCard
                label="Compliance due"
                value={complianceDue.length}
                helper="Overdue or approaching tasks"
                accent="amber"
                icon={<Flag className="h-5 w-5" />}
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Water activity & drying proof</p>
                    <h2 className="text-xl font-semibold text-slate-900">Latest AW submissions</h2>
                    <p className="text-sm text-slate-600">Linked to DRY-FSP-AW-LAB checkpoint and lab uploads.</p>
                  </div>
                  <Link
                    href="/qa/water-activity-proof"
                    className="no-print inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-700"
                  >
                    <Info className="h-4 w-4" />
                    Validation narrative
                  </Link>
                </div>

                {latestAw ? (
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <BadgeCheck className="h-4 w-4 text-emerald-600" />
                        {latestAw.batch_code ?? latestAw.batch_id}
                      </div>
                      <span className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        {latestAw.status ?? 'pending'}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">aw result</dt>
                        <dd className="text-lg font-semibold text-slate-900">
                          {latestAw.water_activity != null ? latestAw.water_activity.toFixed(3) : 'Awaiting result'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">Sample / lab</dt>
                        <dd>{latestAw.sample_id || 'Not provided'}{latestAw.lab_name ? ` · ${latestAw.lab_name}` : ''}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-500">Result received</dt>
                        <dd>{latestAw.result_at ? formatDate(latestAw.result_at) : formatDate(latestAw.checked_at)}</dd>
                      </div>
                    </dl>
                    {latestAw.notes && <p className="mt-2 text-sm text-slate-600">{latestAw.notes}</p>}
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No water activity submissions logged yet for DRY-FSP-AW-LAB.
                  </p>
                )}

                {data.awChecks.length > 1 && (
                  <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
                    {data.awChecks.slice(0, 4).map((item) => (
                      <div key={item.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.batch_code ?? item.batch_id}</p>
                          <p className="text-xs text-slate-500">Logged {formatDateTime(item.checked_at)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-800">
                            aw {item.water_activity != null ? item.water_activity.toFixed(3) : 'pending'}
                          </span>
                          {item.sample_id && (
                            <span className="rounded-full border border-slate-200 px-3 py-1 font-medium text-slate-700">
                              Sample {item.sample_id}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-slate-900">Evidence files</h2>
                  <Link
                    href="/qa"
                    className="no-print text-sm font-semibold text-sky-700 hover:text-sky-800"
                  >
                    Open QA workspace
                  </Link>
                </div>
                {data.awDocuments.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">
                    No water activity lab reports uploaded yet (document type LAB-AW-RESULT).
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {data.awDocuments.map((doc) => (
                      <li key={doc.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {doc.document_number ?? doc.file_name ?? 'Document'}
                            </p>
                            <p className="text-xs text-slate-500">
                              Batch {doc.batch_id} · {formatDate(doc.uploaded_at)}
                            </p>
                          </div>
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="no-print inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              <FileText className="h-4 w-4" />
                              View
                            </a>
                          )}
                        </div>
                        {doc.notes && <p className="mt-1 text-xs text-slate-600">{doc.notes}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">QA completion</p>
                    <h2 className="text-xl font-semibold text-slate-900">Recent batches</h2>
                    <p className="text-sm text-slate-600">Compliance summary with checkpoints and release status.</p>
                  </div>
                  <Link href="/batches" className="no-print text-sm font-semibold text-sky-700 hover:text-sky-800">
                    All batches
                  </Link>
                </div>

                {recentBatches.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-600">No batches found.</p>
                ) : (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                    <div className="divide-y divide-slate-100">
                      {recentBatches.map((record) => {
                        const qaPercent = percent(record.passed_checkpoints ?? 0, record.required_checkpoints ?? 0);
                        const docsPercent = percent(record.approved_documents ?? 0, record.required_documents ?? 0);
                        const href =
                          record.batch_id != null
                            ? (`/qa/${record.batch_id}` as Route)
                            : null;
                        return (
                          <div key={`${record.batch_id}-${record.batch_number}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {record.batch_number ?? record.batch_id}
                                </p>
                                {record.product_name && (
                                  <span className="truncate text-xs text-slate-500">{record.product_name}</span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">
                                Created {formatDate(record.created_at)} · QA {qaPercent ?? 0}% complete
                              </p>
                              {href && (
                                <Link href={href} className="no-print mt-1 inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:text-sky-800">
                                  Open QA detail
                                  <ArrowUpRight className="h-3 w-3" />
                                </Link>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                              <span className="rounded-full border border-slate-200 px-3 py-1 text-slate-800">
                                QA {qaPercent ?? 0}%
                              </span>
                              <span className="rounded-full border border-slate-200 px-3 py-1 text-slate-800">
                                Docs {docsPercent ?? 0}%
                              </span>
                              {record.release_status && (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                                  {record.release_status}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Prerequisite programs</p>
                    <h2 className="text-xl font-semibold text-slate-900">Compliance tasks</h2>
                  </div>
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    {data.tasks.length} active
                  </span>
                </div>

                {topCompliance.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">No compliance tasks configured.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {topCompliance.map((task) => {
                      const badge = statusTone[task.status] ?? statusTone.on_track;
                      return (
                        <div key={task.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-slate-500">{task.category}</p>
                              <p className="text-sm font-semibold text-slate-900">{task.name}</p>
                              {task.description && <p className="text-xs text-slate-600">{task.description}</p>}
                            </div>
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${badge}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-3 text-xs text-slate-700 sm:grid-cols-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              <div>
                                <p className="uppercase tracking-wide text-slate-500">Last completion</p>
                                <p className="font-semibold text-slate-900">
                                  {task.latest_log?.completed_at ? formatDate(task.latest_log.completed_at) : 'Never logged'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-600" />
                              <div>
                                <p className="uppercase tracking-wide text-slate-500">
                                  {task.frequency_type === 'batch_interval' ? 'Batches since test' : 'Next due'}
                                </p>
                                <p className="font-semibold text-slate-900">
                                  {task.frequency_type === 'batch_interval'
                                    ? task.batches_since_last ?? 'Not tracked'
                                    : task.next_due_at
                                    ? formatDate(task.next_due_at)
                                    : 'Set after first record'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Traceability</p>
                  <h2 className="text-xl font-semibold text-slate-900">Recalls & mock recalls</h2>
                </div>
                <Link
                  href="/inventory"
                  className="no-print inline-flex items-center gap-1 text-sm font-semibold text-sky-700 hover:text-sky-800"
                >
                  Inventory & lots
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>

              {data.recalls.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">No recall or mock recall events recorded.</p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.recalls.slice(0, 4).map((recall) => (
                    <div key={recall.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">{recall.reason ?? 'Recall'}</p>
                        <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                          {recall.status ?? 'open'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Initiated {formatDate(recall.initiated_at)}</p>
                      {recall.lot && (
                        <p className="mt-2 text-sm text-slate-700">
                          Lot {recall.lot.lot_number ?? recall.lot.internal_lot_code} · {recall.lot.material_name ?? 'Material'}
                        </p>
                      )}
                      {recall.batches.length > 0 && (
                        <div className="mt-2 space-y-1 text-xs text-slate-600">
                          {recall.batches.map((b) => (
                            <div key={b.id} className="flex items-center gap-2">
                              <span className="rounded bg-white px-2 py-0.5 font-semibold text-slate-800">{b.batch_id}</span>
                              <span>{b.product_name ?? 'Batch'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {recall.notes && <p className="mt-2 text-xs text-slate-600">{recall.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          nav,
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
          .print-content {
            max-width: 1100px;
            margin: 0 auto;
          }
        }
      `}</style>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  accent = 'sky',
  icon,
}: {
  label: string;
  value: number;
  helper?: string;
  accent?: 'sky' | 'amber';
  icon?: ReactNode;
}) {
  const accentClass =
    accent === 'amber'
      ? 'from-amber-500/90 to-orange-500'
      : 'from-sky-500/90 to-blue-600';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-gradient-to-br px-3 py-2 text-white shadow-sm">
          {icon}
        </div>
        <span className={`rounded-full bg-gradient-to-r ${accentClass} px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white`}>
          Live
        </span>
      </div>
      <h3 className="mt-4 text-sm font-medium text-slate-600">{label}</h3>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      {helper && <p className="text-xs text-slate-500">{helper}</p>}
    </div>
  );
}
