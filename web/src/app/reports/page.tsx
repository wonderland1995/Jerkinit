'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, Filter, RefreshCw } from 'lucide-react';

interface ComplianceRecord {
  batch_id: string;
  batch_number: string | null;
  product_name: string | null;
  batch_status: string | null;
  created_at: string;
  completed_at: string | null;
  total_ingredients: number | null;
  measured_ingredients: number | null;
  in_tolerance_count: number | null;
  tolerance_compliance_percent: number | string | null;
  required_checkpoints: number | null;
  passed_checkpoints: number | null;
  required_documents: number | null;
  approved_documents: number | null;
  release_status: string | null;
  release_number: string | null;
  approved_by: string | null;
  approved_at: string | null;
}

type BatchStatusFilter = 'all' | 'in_progress' | 'completed' | 'released' | 'cancelled';

const statusLabels: Record<Exclude<BatchStatusFilter, 'all'>, string> = {
  in_progress: 'In Progress',
  completed: 'Completed',
  released: 'Released',
  cancelled: 'Cancelled',
};

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const parseDateInput = (value: string | null, isEnd = false) => {
  if (!value) return null;
  const suffix = isEnd ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  return `${value}${suffix}`;
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatPercent = (value: number | string | null) => {
  if (value == null) return 'N/A';
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return 'N/A';
  return `${numeric.toFixed(2)}%`;
};

const formatInteger = (value: number | null) => {
  if (value == null) return 'N/A';
  if (!Number.isFinite(value)) return 'N/A';
  return value.toString();
};

const escapeCsvValue = (value: unknown) => {
  if (value == null) return '';
  const stringValue = String(value).replace(/\r?\n/g, ' ').trim();
  if (/[",]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export default function ReportsPage() {
  const today = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 29);
    return start;
  }, []);

  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(toDateInputValue(defaultStart));
  const [endDate, setEndDate] = useState<string>(toDateInputValue(today));
  const [statusFilter, setStatusFilter] = useState<BatchStatusFilter>('all');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadRecords = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        const startIso = parseDateInput(startDate);
        const endIso = parseDateInput(endDate, true);

        if (startIso) params.set('start', startIso);
        if (endIso) params.set('end', endIso);
        if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

        const query = params.toString();
        const response = await fetch(`/api/reports/compliance${query ? `?${query}` : ''}`, {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to load compliance data');
        }

        const payload: { records: ComplianceRecord[] } = await response.json();
        setRecords(payload.records ?? []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Compliance report load error:', err);
          setError('Could not load compliance data. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadRecords();

    return () => controller.abort();
  }, [startDate, endDate, statusFilter]);

  const summary = useMemo(() => {
    if (!records.length) {
      return {
        batches: 0,
        averageTolerance: null as number | null,
        passedCheckpoints: 0,
        totalCheckpoints: 0,
        approvedDocuments: 0,
        totalDocuments: 0,
      };
    }

    const toleranceValues: number[] = [];
    let passedCheckpoints = 0;
    let totalCheckpoints = 0;
    let approvedDocuments = 0;
    let totalDocuments = 0;

    for (const record of records) {
      const tolerance = Number.parseFloat(String(record.tolerance_compliance_percent ?? ''));
      if (Number.isFinite(tolerance)) toleranceValues.push(tolerance);

      passedCheckpoints += record.passed_checkpoints ?? 0;
      totalCheckpoints += record.required_checkpoints ?? 0;
      approvedDocuments += record.approved_documents ?? 0;
      totalDocuments += record.required_documents ?? 0;
    }

    const averageTolerance =
      toleranceValues.length > 0
        ? toleranceValues.reduce((sum, value) => sum + value, 0) / toleranceValues.length
        : null;

    return {
      batches: records.length,
      averageTolerance,
      passedCheckpoints,
      totalCheckpoints,
      approvedDocuments,
      totalDocuments,
    };
  }, [records]);

  const handleResetFilters = () => {
    setStartDate(toDateInputValue(defaultStart));
    setEndDate(toDateInputValue(today));
    setStatusFilter('all');
  };

  const handleExportCsv = () => {
    if (!records.length) return;

    setIsExporting(true);
    try {
      const headers = [
        'Batch ID',
        'Batch Number',
        'Product Name',
        'Status',
        'Created At',
        'Completed At',
        'Total Ingredients',
        'Measured Ingredients',
        'In Tolerance Count',
        'Tolerance %',
        'Required Checkpoints',
        'Passed Checkpoints',
        'Required Documents',
        'Approved Documents',
        'Release Status',
        'Release Number',
        'Approved By',
        'Approved At',
      ];

      const rows = records.map((record) => [
        escapeCsvValue(record.batch_id),
        escapeCsvValue(record.batch_number),
        escapeCsvValue(record.product_name),
        escapeCsvValue(record.batch_status),
        escapeCsvValue(formatDateTime(record.created_at)),
        escapeCsvValue(formatDateTime(record.completed_at)),
        escapeCsvValue(record.total_ingredients ?? ''),
        escapeCsvValue(record.measured_ingredients ?? ''),
        escapeCsvValue(record.in_tolerance_count ?? ''),
        escapeCsvValue(
          formatPercent(
            record.tolerance_compliance_percent != null
              ? Number.parseFloat(String(record.tolerance_compliance_percent))
              : null
          )
        ),
        escapeCsvValue(record.required_checkpoints ?? ''),
        escapeCsvValue(record.passed_checkpoints ?? ''),
        escapeCsvValue(record.required_documents ?? ''),
        escapeCsvValue(record.approved_documents ?? ''),
        escapeCsvValue(record.release_status),
        escapeCsvValue(record.release_number),
        escapeCsvValue(record.approved_by),
        escapeCsvValue(formatDateTime(record.approved_at)),
      ]);

      const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const rangeLabel = `${startDate || 'all'}_to_${endDate || 'all'}`;

      link.href = url;
      link.download = `compliance-report_${rangeLabel}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Compliance Exports</h1>
            <p className="text-slate-600">
              Review batch compliance performance and download detailed CSV exports.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!records.length || isExporting}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Preparing...' : 'Download CSV'}
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label htmlFor="start-date" className="block text-xs font-semibold uppercase text-slate-500">
                    Start date
                  </label>
                  <input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>

                <div>
                  <label htmlFor="end-date" className="block text-xs font-semibold uppercase text-slate-500">
                    End date
                  </label>
                  <input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                </div>

                <div>
                  <label htmlFor="status" className="block text-xs font-semibold uppercase text-slate-500">
                    Batch status
                  </label>
                  <div className="relative mt-1">
                    <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      id="status"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as BatchStatusFilter)}
                      className="w-48 appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    >
                      <option value="all">All statuses</option>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      v
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Reset filters
              </button>
            </div>
          </header>

          <div className="grid gap-4 border-b border-slate-200 bg-slate-50/60 px-6 py-5 md:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Batches</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{summary.batches}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Avg tolerance</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {summary.averageTolerance != null ? `${summary.averageTolerance.toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Checkpoints</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {summary.passedCheckpoints}/{summary.totalCheckpoints}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Documents</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {summary.approvedDocuments}/{summary.totalDocuments}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {['Batch', 'Product', 'Status', 'Created', 'Completed', 'Ingredients', 'Tolerance', 'QA', 'Docs', 'Release'].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
                {loading && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      Loading compliance data...
                    </td>
                  </tr>
                )}

                {!loading && error && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-rose-600">
                      <div className="flex items-center justify-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <span>{error}</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && !error && !records.length && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                      No batches found for the selected filters.
                    </td>
                  </tr>
                )}

                {!loading &&
                  !error &&
                  records.map((record) => {
                    const ingredientsSummary = `${formatInteger(record.measured_ingredients)} / ${formatInteger(record.total_ingredients)}`;
                    const qaSummary = `${formatInteger(record.passed_checkpoints)} / ${formatInteger(record.required_checkpoints)}`;
                    const docsSummary = `${formatInteger(record.approved_documents)} / ${formatInteger(record.required_documents)}`;

                    return (
                      <tr key={record.batch_id} className="hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          <div className="flex flex-col">
                            <span>{record.batch_number ?? record.batch_id}</span>
                            <span className="text-xs text-slate-500">{record.batch_id}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{record.product_name ?? 'N/A'}</td>
                        <td className="px-4 py-3 capitalize">{record.batch_status ?? 'N/A'}</td>
                        <td className="px-4 py-3">{formatDateTime(record.created_at)}</td>
                        <td className="px-4 py-3">{formatDateTime(record.completed_at)}</td>
                        <td className="px-4 py-3">{ingredientsSummary}</td>
                        <td className="px-4 py-3">{formatPercent(record.tolerance_compliance_percent)}</td>
                        <td className="px-4 py-3">{qaSummary}</td>
                        <td className="px-4 py-3">{docsSummary}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{record.release_status ?? 'N/A'}</span>
                            <span className="text-xs text-slate-500">
                              {record.release_number ? `#${record.release_number}` : ''}
                              {record.approved_by ? ` - ${record.approved_by}` : ''}
                            </span>
                            {record.approved_at && (
                              <span className="text-xs text-slate-400">{formatDateTime(record.approved_at)}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
