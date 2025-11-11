// src/app/qa/[batchId]/page.tsx
/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState, FormEvent, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ToastProvider';
import { Download, FileDown, FileText, Loader2, Camera, Trash2 } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { QADocument } from '@/types/qa';

// ---------- Types that match your DB ----------
type Stage =
  | 'preparation'
  | 'mixing'
  | 'marination'
  | 'drying'
  | 'packaging'
  | 'final';

type QAStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional';

interface Checkpoint {
  id: string;
  code: string;
  name: string;
  description: string;
  stage: Stage;
  required: boolean;
  display_order: number;
  active?: boolean;
}

interface QACheck {
  id: string;
  checkpoint_id: string;
  status: QAStatus;
  checked_by: string | null;
  checked_at: string | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  ph_level: number | null;
  water_activity: number | null;
  notes: string | null;
  corrective_action: string | null;
  metadata?: Record<string, unknown> | null;
}

interface ProductLite {
  name: string;
}

interface BatchDetails {
  id: string;
  batch_id: string; // your public 'batch code'
  status: 'in_progress' | 'completed' | 'cancelled' | string;
  product?: ProductLite;
}

type QADocumentWithType = QADocument & {
  document_type?: {
    code: string | null;
    name: string | null;
  } | null;
};

const STAGES: Array<{ key: Stage; label: string }> = [
  { key: 'preparation', label: 'Preparation' },
  { key: 'mixing', label: 'Mixing' },
  { key: 'marination', label: 'Marination' },
  { key: 'drying', label: 'Drying' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'final', label: 'Final' },
];

const getStageLabel = (stage: Stage) =>
  STAGES.find((s) => s.key === stage)?.label ?? stage.charAt(0).toUpperCase() + stage.slice(1);

// ---------- Page ----------
export default function BatchQAPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.batchId as string;
  const toast = useToast();

  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [qaChecks, setQAChecks] = useState<Record<string, QACheck>>({});
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<Stage>('preparation');
  const [documents, setDocuments] = useState<QADocumentWithType[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentNotes, setDocumentNotes] = useState('');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const documentTypeCode = 'QA-PHOTO';
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [batchRes, checkpointsRes, checksRes] = await Promise.all([
        fetch(`/api/batches/${batchId}`),
        fetch('/api/qa/checkpoints'),
        fetch(`/api/qa/batch/${batchId}`),
      ]);

      const batchJson = (await batchRes.json()) as { batch: BatchDetails | null };
      const checkpointsJson = (await checkpointsRes.json()) as { checkpoints: Checkpoint[] };
      const checksJson = (await checksRes.json()) as { checks: QACheck[] };

      setBatch(batchJson.batch ?? null);

      // keep only active, order by display_order then required
      const cps = (checkpointsJson.checkpoints ?? [])
        .filter((c) => c.active !== false)
        .sort((a, b) =>
          a.stage === b.stage
            ? a.display_order - b.display_order || (b.required ? 1 : -1)
            : 0,
        );
      setCheckpoints(cps);

      const map: Record<string, QACheck> = {};
      (checksJson.checks ?? []).forEach((c) => {
        map[c.checkpoint_id] = c;
      });
      setQAChecks(map);
    } catch (e) {
      console.error('Failed to fetch QA data', e);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  const fetchDocuments = useCallback(async () => {
    try {
      setDocumentsLoading(true);
      const res = await fetch(`/api/qa/documents?batchId=${batchId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load documents');
      const data = (await res.json()) as { documents?: QADocumentWithType[] };
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch (error) {
      console.error('Failed to load QA documents', error);
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const stageCheckpoints = useMemo(
    () => checkpoints.filter((c) => c.stage === activeStage),
    [checkpoints, activeStage],
  );

  const overallStage = useMemo<Stage>(() => {
    const order: Stage[] = ['preparation', 'mixing', 'marination', 'drying', 'packaging', 'final'];
    for (const key of order) {
      const required = checkpoints.filter((cp) => cp.stage === key && cp.required);
      if (required.length > 0) {
        const pending = required.some((cp) => qaChecks[cp.id]?.status !== 'passed');
        if (pending) return key;
      }
    }
    return 'final';
  }, [checkpoints, qaChecks]);

  const stagePassed = stageCheckpoints.filter((cp) => qaChecks[cp.id]?.status === 'passed').length;
  const stageTotal = stageCheckpoints.length;
  const stageProgress = stageTotal > 0 ? Math.round((stagePassed / stageTotal) * 100) : 0;

  const qaComplete = useMemo(() => {
    return checkpoints
      .filter((cp) => cp.required)
      .every((cp) => qaChecks[cp.id]?.status === 'passed');
  }, [checkpoints, qaChecks]);

  const currentStageLabel = useMemo(() => {
    if (qaComplete) return 'QA Complete';
    const match = STAGES.find((s) => s.key === overallStage);
    return match ? match.label : 'QA in progress';
  }, [qaComplete, overallStage]);

  const currentStageBadgeClass = useMemo(() => {
    if (qaComplete) return 'bg-green-100 text-green-700';
    const stageColor: Partial<Record<Stage, string>> = {
      preparation: 'bg-slate-100 text-slate-700',
      mixing: 'bg-blue-100 text-blue-700',
      marination: 'bg-amber-100 text-amber-700',
      drying: 'bg-orange-100 text-orange-700',
      packaging: 'bg-indigo-100 text-indigo-700',
      final: 'bg-emerald-100 text-emerald-700',
    };
    return stageColor[overallStage] ?? 'bg-gray-100 text-gray-700';
  }, [overallStage, qaComplete]);

  // Determine current/next checkpoint within the active stage
  const currentCheckpoint = useMemo(() => {
    const ordered = [...stageCheckpoints].sort((a, b) => a.display_order - b.display_order);
    const firstRequiredNotPassed = ordered.find((c) => c.required && qaChecks[c.id]?.status !== 'passed');
    const firstOptionalNotPassed = ordered.find((c) => !c.required && qaChecks[c.id]?.status !== 'passed');
    return firstRequiredNotPassed ?? firstOptionalNotPassed ?? null;
  }, [stageCheckpoints, qaChecks]);

  const passAllRequired = async () => {
    const required = stageCheckpoints.filter((c) => c.required);
    await Promise.all(
      required.map((c) =>
        fetch('/api/qa/checkpoint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch_id: batchId,
            checkpoint_id: c.id,
            status: 'passed' as QAStatus,
            checked_by: 'Operator',
          }),
        }),
      ),
    );
    await fetchData();
  };

  const handleDocumentFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setDocumentFile(file);
  };

  const handleUploadDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!documentFile) {
      toast.error('Select a file to upload.');
      return;
    }

    setUploadingDocument(true);
    try {
      const payload = new FormData();
      payload.append('batch_id', batchId);
      payload.append('document_type_code', documentTypeCode);
      payload.append('document_number', `${batch?.batch_id ?? batchId}-${Date.now()}`);
      payload.append('status', 'pending');
      payload.append('file', documentFile);
      if (documentNotes.trim()) {
        payload.append('notes', documentNotes.trim());
      }

      const res = await fetch('/api/qa/documents', {
        method: 'POST',
        body: payload,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Failed to upload document');
      }

      toast.success('Attachment uploaded.');
      setDocumentNotes('');
      setDocumentFile(null);
      if (documentInputRef.current) {
        documentInputRef.current.value = '';
      }
      await fetchDocuments();
    } catch (error) {
      console.error('Failed to upload QA document', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload document.');
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Delete this attachment?')) {
      return;
    }
    setDeletingDocId(docId);
    try {
      const res = await fetch(`/api/qa/documents?id=${docId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Failed to delete document');
      }
      toast.success('Attachment removed.');
      await fetchDocuments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete document.');
    } finally {
      setDeletingDocId(null);
    }
  };

  const summarizeTemperatures = (check?: QACheck): string => {
    if (!check) return '-';
    const parts: string[] = [];
    if (typeof check.temperature_c === 'number') {
      parts.push(`${Number(check.temperature_c).toFixed(1)} °C`);
    }
    const metadata =
      check.metadata && typeof check.metadata === 'object'
        ? (check.metadata as Record<string, unknown>)
        : null;
    if (metadata && Array.isArray((metadata as { readings?: unknown }).readings)) {
      const readings = (metadata as { readings: Array<Record<string, unknown>> }).readings;
      readings.forEach((reading, idx) => {
        const tempValue =
          typeof reading?.tempC === 'number'
            ? reading.tempC
            : typeof reading?.tempC === 'string'
            ? Number(reading.tempC)
            : null;
        if (tempValue != null && Number.isFinite(tempValue)) {
          parts.push(`Piece ${idx + 1}: ${Number(tempValue).toFixed(1)} °C`);
        }
      });
    }
    if (metadata && metadata.drying_run && typeof metadata.drying_run === 'object') {
      const oven = (metadata.drying_run as Record<string, unknown>).oven_temp_c;
      if (typeof oven === 'number') {
        parts.push(`Oven ${oven.toFixed(1)} °C`);
      }
    }
    return parts.length ? parts.join('; ') : '-';
  };

  const summarizeOtherReadings = (check?: QACheck): string => {
    if (!check) return '-';
    const parts: string[] = [];
    if (typeof check.humidity_percent === 'number') {
      parts.push(`Humidity ${Number(check.humidity_percent).toFixed(1)} %`);
    }
    if (typeof check.ph_level === 'number') {
      parts.push(`pH ${Number(check.ph_level).toFixed(2)}`);
    }
    if (typeof check.water_activity === 'number') {
      parts.push(`aw ${Number(check.water_activity).toFixed(3)}`);
    }
    const metadata =
      check.metadata && typeof check.metadata === 'object'
        ? (check.metadata as Record<string, unknown>)
        : null;
    if (metadata && metadata.drying_run && typeof metadata.drying_run === 'object') {
      const run = metadata.drying_run as { start_iso?: string; end_iso?: string };
      if (run.start_iso || run.end_iso) {
        parts.push(
          `Drying ${run.start_iso ? formatDateTime(run.start_iso) : '-'} → ${
            run.end_iso ? formatDateTime(run.end_iso) : '-'
          }`,
        );
      }
    }
    if (check.notes) {
      parts.push(`Notes: ${check.notes}`);
    }
    return parts.length ? parts.join('; ') : '-';
  };

  const isImageFile = (value?: string | null) => {
    if (!value) return false;
    const normalized = value.split('?')[0];
    return /\.(png|jpe?g|gif|bmp|webp)$/i.test(normalized);
  };

  const handleExportPdf = async () => {
    if (!checkpoints.length) {
      toast.error('No checkpoints available to export.');
      return;
    }
    setExportingPdf(true);
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
      const autoTable = autoTableModule.default;
      if (typeof autoTable !== 'function') {
        throw new Error('PDF export module failed to load');
      }

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const marginLeft = 14;
      let cursorY = 18;

      doc.setFontSize(16);
      doc.text('QA Test Sheet', marginLeft, cursorY);
      cursorY += 7;

      doc.setFontSize(11);
      doc.text(`Batch: ${batch?.batch_id ?? batchId}`, marginLeft, cursorY);
      cursorY += 5;
      doc.text(`Product: ${batch?.product?.name ?? '-'}`, marginLeft, cursorY);
      cursorY += 5;
      doc.text(`Status: ${currentStageLabel}`, marginLeft, cursorY);
      cursorY += 5;
      doc.text(`Generated: ${formatDateTime(new Date().toISOString())}`, marginLeft, cursorY);
      cursorY += 7;

      doc.setFontSize(12);
      doc.text('Checkpoint Summary', marginLeft, cursorY);
      cursorY += 4;

      const qaRows = checkpoints.map((cp) => {
        const check = qaChecks[cp.id];
        return [
          cp.code,
          cp.name,
          getStageLabel(cp.stage),
          (check?.status ?? 'pending').toUpperCase(),
          summarizeTemperatures(check),
          summarizeOtherReadings(check),
          check?.checked_at ? formatDateTime(check.checked_at) : '-',
        ];
      });

      autoTable(doc, {
        startY: cursorY,
        head: [['Code', 'Checkpoint', 'Stage', 'Status', 'Temperatures', 'Other Readings', 'Checked At']],
        body: qaRows,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      });

      const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
      cursorY = (lastTable?.finalY ?? cursorY) + 8;

      doc.setFontSize(12);
      doc.text('Supporting Documents', marginLeft, cursorY);
      cursorY += 4;

      if (documents.length > 0) {
        const docRows = documents.map((docItem) => [
          docItem.file_name ?? 'Attachment',
          docItem.document_type?.name ?? docItem.document_type?.code ?? 'Attachment',
          formatDateTime(docItem.uploaded_at),
          docItem.notes ?? '-',
        ]);

        autoTable(doc, {
          startY: cursorY,
          head: [['File', 'Type', 'Uploaded', 'Notes']],
          body: docRows,
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [22, 101, 52], textColor: 255 },
        });
      } else {
        doc.setFontSize(10);
        doc.text('No supporting documents uploaded.', marginLeft, cursorY);
      }

      const safeName = (batch?.batch_id ?? batchId).replace(/[^A-Za-z0-9-_]/g, '_');
      doc.save(`${safeName}_qa.pdf`);
    } catch (error) {
      console.error('Failed to export QA PDF', error);
      toast.error(error instanceof Error ? error.message : 'Failed to export QA PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900" />
          <p className="mt-4 text-gray-600">Loading QA checkpoints...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-5">
          <button
            onClick={() => router.push('/qa')}
            className="mb-2 text-sm text-blue-600 hover:text-blue-700"
          >
            {'< Back to QA list'}
          </button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold">QA Test Sheet</h1>
              <p className="text-gray-600">
                {batch?.batch_id} {batch?.product?.name ? `- ${batch.product.name}` : ''}
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
              <button
                onClick={handleExportPdf}
                disabled={exportingPdf}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exportingPdf ? 'Exporting...' : 'Export PDF'}
              </button>
              <span
                className={`self-start sm:self-auto rounded-full px-3 py-1 text-sm font-medium ${currentStageBadgeClass}`}
              >
                {currentStageLabel}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Stage Tabs */}
      <div className="sticky top-[81px] z-10 bg-white/90 backdrop-blur border-b">
        <div className="mx-auto max-w-6xl px-4 sm:px-5">
          <div className="flex gap-2 overflow-x-auto py-2">
            {STAGES.map((s) => {
              const list = checkpoints.filter((c) => c.stage === s.key);
              const passed = list.filter((c) => qaChecks[c.id]?.status === 'passed').length;
              const total = list.length;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveStage(s.key)}
                  className={`flex-shrink-0 rounded-xl px-4 py-2 font-medium transition ${
                    activeStage === s.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {s.label}
                  <span className="ml-2 text-xs opacity-75">
                    {passed}/{total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stage progress + quick actions */}
      <section className="mx-auto max-w-6xl px-4 py-4 sm:px-5">
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-medium text-gray-700">
                {STAGES.find((s) => s.key === activeStage)?.label} progress
              </div>
              <div className="text-sm font-semibold text-gray-900">{stageProgress}%</div>
              {currentCheckpoint && (
                <div className="mt-0.5 text-xs text-gray-500">
                  Current: {currentCheckpoint.code} - {currentCheckpoint.name}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 sm:justify-end">
              <button
                onClick={passAllRequired}
                className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 sm:w-auto"
              >
                Pass all required in stage
              </button>
              <button
                onClick={() => setActiveStage('final')}
                className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 sm:w-auto"
              >
                Jump to Final
              </button>
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-green-600 transition-all"
              style={{ width: `${stageProgress}%` }}
            />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-xl border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500">Evidence</p>
                <h2 className="text-lg font-semibold text-gray-900">Photos & Docs</h2>
              </div>
              <span className="text-xs text-gray-500">
                {documents.length} item{documents.length === 1 ? '' : 's'}
              </span>
            </div>
            {documentsLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                No supporting documents uploaded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => {
                  const isImage = isImageFile(doc.file_name ?? doc.file_url ?? undefined);
                  return (
                    <div key={doc.id} className="flex gap-3 rounded-lg border p-3">
                      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-gray-100">
                        {isImage && doc.file_url ? (
                          <img
                            src={doc.file_url}
                            alt={doc.file_name ?? 'QA attachment'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-gray-500">
                            <FileText className="h-6 w-6" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {doc.file_name ?? 'Attachment'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(doc.document_type?.name ?? doc.document_type?.code ?? 'Attachment')}{' '}
                          · {formatDateTime(doc.uploaded_at)}
                        </p>
                        {doc.notes && (
                          <p className="mt-1 text-sm text-gray-600 break-words">{doc.notes}</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {doc.file_url && (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noreferrer"
                              download={doc.file_name ?? undefined}
                              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              <FileDown className="h-3.5 w-3.5" />
                              View
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleDeleteDocument(doc.id)}
                            disabled={deletingDocId === doc.id}
                            className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            {deletingDocId === doc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">Upload</p>
            <h3 className="text-lg font-semibold text-gray-900">Add photo / document</h3>
            <p className="text-sm text-gray-500">
              Attach supporting evidence straight from the floor. Images and PDFs are supported.
            </p>
            <form onSubmit={handleUploadDocument} className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">File</label>
                <input
                  ref={documentInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleDocumentFileChange}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  rows={3}
                  value={documentNotes}
                  onChange={(e) => setDocumentNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Optional context or checkpoint reference..."
                />
              </div>
              <button
                type="submit"
                disabled={uploadingDocument || !documentFile}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {uploadingDocument ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {uploadingDocument ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          </div>
        </div>

        {/* Cards */}
        <div className="mt-4 space-y-4">
          {stageCheckpoints.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
              No checkpoints defined for this stage
            </div>
          ) : (
            stageCheckpoints.map((cp) => (
              <CheckpointCard
                key={cp.id}
                checkpoint={cp}
                check={qaChecks[cp.id]}
                onChange={async (status, data) => {
                  try {
                    const res = await fetch('/api/qa/checkpoint', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        batch_id: batchId,
                        checkpoint_id: cp.id,
                        status,
                        ...data,
                        checked_by: 'Operator',
                      }),
                    });
                    if (!res.ok) {
                      const j = (await res.json().catch(() => ({}))) as { error?: string };
                      toast.error(j.error ?? 'Failed to update checkpoint');
                      return;
                    }
                    toast.success('Checkpoint updated.');
                    await fetchData();
                  } catch (error) {
                    console.error('Failed to update checkpoint', error);
                    toast.error('Failed to update checkpoint');
                  }
                }}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

// ---------- CheckpointCard (inline component) ----------
// --- put this BELOW your page component, replacing your existing CheckpointCard ---

interface CheckpointCardProps {
  checkpoint: Checkpoint;
  check: QACheck | undefined;
  onChange: (status: QAStatus, data: Partial<QACheck>) => void;
}

type FieldFlags = {
  temperature?: boolean;
  humidity?: boolean;
  ph?: boolean;
  aw?: boolean;
  notes?: boolean;       // default true
  managedExternally?: boolean; // shows banner, hides actions
  tripleTemps?: boolean;
  dryingRun?: boolean;
};

const toLocalDateTimeInput = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const toIsoFromLocalInput = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getTime() + parsed.getTimezoneOffset() * 60000).toISOString();
};

const extractTripleTemps = (metadata?: Record<string, unknown> | null): [string, string, string] => {
  if (!metadata || typeof metadata !== 'object') return ['', '', ''];
  const raw = Array.isArray((metadata as Record<string, unknown>)['readings'])
    ? ((metadata as Record<string, unknown>)['readings'] as Array<Record<string, unknown>>)
    : [];

  return [0, 1, 2].map((idx) => {
    const entry = raw[idx];
    if (!entry || typeof entry !== 'object') return '';
    const numeric =
      typeof entry['tempC'] === 'number'
        ? entry['tempC']
        : typeof entry['temp'] === 'number'
        ? entry['temp']
        : typeof entry['tempC'] === 'string'
        ? Number(entry['tempC'])
        : typeof entry['temp'] === 'string'
        ? Number(entry['temp'])
        : null;
    return Number.isFinite(numeric) ? String(numeric) : '';
  }) as [string, string, string];
};

const extractDryingRun = (metadata?: Record<string, unknown> | null) => {
  if (!metadata || typeof metadata !== 'object') {
    return { oven: '', start: '', end: '' };
  }
  const raw = (metadata as Record<string, unknown>)['drying_run'];
  if (!raw || typeof raw !== 'object') {
    return { oven: '', start: '', end: '' };
  }
  const ovenValue =
    typeof raw['oven_temp_c'] === 'number'
      ? raw['oven_temp_c']
      : typeof raw['oven_temp_c'] === 'string'
      ? Number(raw['oven_temp_c'])
      : null;
  const startRaw =
    typeof raw['start_iso'] === 'string'
      ? raw['start_iso']
      : typeof raw['startISO'] === 'string'
      ? raw['startISO']
      : null;
  const endRaw =
    typeof raw['end_iso'] === 'string'
      ? raw['end_iso']
      : typeof raw['endISO'] === 'string'
      ? raw['endISO']
      : null;
  return {
    oven: Number.isFinite(ovenValue) ? String(ovenValue) : '',
    start: toLocalDateTimeInput(startRaw),
    end: toLocalDateTimeInput(endRaw),
  };
};

// Map the EXACT inputs each checkpoint code needs.
// Anything not listed falls back to "notes only".
const FIELDS_BY_CODE: Record<string, FieldFlags> = {
  // --- Preparation (some moved out of this page) ---
  // Raw Beef Receiving Temperature -> handled in Receiving flow, not here
  'PREP-CCP-001': { managedExternally: true },

  // Lot number recording: status + optional note only
  'PREP-004': { notes: true },

  // Ingredient weighing accuracy is verified by your batch entry/recipe table
  'MIX-CCP-001': { notes: true },
  'MIX-TEMP': { temperature: true, notes: true },
  'MIX-CORE': { temperature: true, notes: true },

  // pH Measurement
  'MIX-005': { ph: true, notes: true },

  // Product Temperature Control (during mixing)
  'MIX-CCP-004': { temperature: true, notes: true },
  'MIX-TEMPERATURE': { temperature: true, notes: true },

  // Core Temperature Achievement (drying)
  'DRY-CCP-003': { notes: true, tripleTemps: true },
  'DRY-CORE': { notes: true, tripleTemps: true },

  // Temperature Log - Hourly (we allow spot entry, or note)
  'DRY-CCP-004': { temperature: true, notes: true, dryingRun: true },
  'DRY-TEMP': { temperature: true, notes: true, dryingRun: true },
  'DRY-TEMPERATURE': { temperature: true, notes: true, dryingRun: true },

  // Water Activity Test
  'DRY-CCP-005': { aw: true, notes: true },
  'DRY-AW': { aw: true, notes: true },

  // Yield Calculation is usually computed later (final) — just note/mark
  'FIN-006': { notes: true },

  // Metal detection / label compliance / storage checks — status + optional notes
  'PKG-CCP-001': { notes: true },
  'PKG-CCP-002': { notes: true },
  'PKG-CCP-003': { notes: true },
  'PKG-CCP-004': { notes: true },
  'PKG-CCP-005': { notes: true },
  'FIN-CCP-001': { notes: true },
  'FIN-CCP-002': { notes: true },
};

function getFieldFlags(cp: Checkpoint): FieldFlags {
  const mapped = FIELDS_BY_CODE[cp.code];
  const base: FieldFlags = mapped ? { notes: true, ...mapped } : { notes: true };

  if (base.managedExternally) {
    return base;
  }

  const text = `${cp.code ?? ''} ${cp.name ?? ''} ${cp.description ?? ''}`
    .toLowerCase();

  if (!base.temperature && /temp|core|degc|deg c|celsius/.test(text)) {
    base.temperature = true;
  }
  if (!base.humidity && /humidity|%rh|relative humidity/.test(text)) {
    base.humidity = true;
  }
  if (!base.ph && /\bph\b/.test(text)) {
    base.ph = true;
  }
  if (!base.aw && /(water activity|a_w|aw)/.test(text)) {
    base.aw = true;
  }

  return base;
}

function CheckpointCard({ checkpoint, check, onChange }: CheckpointCardProps) {
  const toast = useToast();
  const fields = getFieldFlags(checkpoint);
  const [expanded, setExpanded] = useState(() =>
    Boolean(fields.temperature || fields.humidity || fields.ph || fields.aw || fields.tripleTemps || fields.dryingRun),
  );

  // Keep form inputs as strings for easy empty checks
  const [temperature, setTemperature] = useState<string>(check?.temperature_c?.toString() ?? '');
  const [humidity, setHumidity] = useState<string>(check?.humidity_percent?.toString() ?? '');
  const [ph, setPh] = useState<string>(check?.ph_level?.toString() ?? '');
  const [aw, setAw] = useState<string>(check?.water_activity?.toString() ?? '');
  const [notes, setNotes] = useState<string>(check?.notes ?? '');
  const [action, setAction] = useState<string>(check?.corrective_action ?? '');
  const [pieceTemps, setPieceTemps] = useState<[string, string, string]>(() =>
    extractTripleTemps((check?.metadata as Record<string, unknown> | null) ?? null),
  );
  const initialDrying = extractDryingRun((check?.metadata as Record<string, unknown> | null) ?? null);
  const [ovenTemp, setOvenTemp] = useState<string>(initialDrying.oven);
  const [dryingStart, setDryingStart] = useState<string>(initialDrying.start);
  const [dryingEnd, setDryingEnd] = useState<string>(initialDrying.end);

  const status: QAStatus = check?.status ?? 'pending';

  useEffect(() => {
    setTemperature(check?.temperature_c != null ? String(check.temperature_c) : '');
    setHumidity(check?.humidity_percent != null ? String(check.humidity_percent) : '');
    setPh(check?.ph_level != null ? String(check.ph_level) : '');
    setAw(check?.water_activity != null ? String(check.water_activity) : '');
    setNotes(check?.notes ?? '');
    setAction(check?.corrective_action ?? '');
    if (fields.tripleTemps) {
      setPieceTemps(extractTripleTemps((check?.metadata as Record<string, unknown> | null) ?? null));
    }
    if (fields.dryingRun) {
      const parsed = extractDryingRun((check?.metadata as Record<string, unknown> | null) ?? null);
      setOvenTemp(parsed.oven);
      setDryingStart(parsed.start);
      setDryingEnd(parsed.end);
    } else {
      setOvenTemp('');
      setDryingStart('');
      setDryingEnd('');
    }
  }, [
    check?.temperature_c,
    check?.humidity_percent,
    check?.ph_level,
    check?.water_activity,
    check?.notes,
    check?.corrective_action,
    check?.metadata,
    fields.tripleTemps,
    fields.dryingRun,
  ]);

  const validateIfPassing = (nextStatus: QAStatus = status): string | null => {
    // If checkpoint requires a specific reading and user is marking PASSED, require it.
    if (nextStatus === 'passed') {
      if (fields.temperature && temperature === '') return 'Temperature (deg C) is required for this checkpoint.';
      if (fields.humidity && humidity === '') return 'Humidity (%) is required for this checkpoint.';
      if (fields.ph && ph === '') return 'pH is required for this checkpoint.';
      if (fields.aw && aw === '') return 'Water activity (aw) is required for this checkpoint.';
      if (fields.tripleTemps && pieceTemps.some((temp) => temp.trim() === '')) {
        return 'All three cooking temperature readings are required.';
      }
      if (fields.dryingRun) {
        if (ovenTemp.trim() === '') return 'Drying oven temperature is required.';
        if (!dryingStart || !dryingEnd) return 'Drying start and finish times are required.';
      }
    }
    return null;
  };

  const buildMetadataPayload = (): Record<string, unknown> | null => {
    if (!fields.tripleTemps && !fields.dryingRun) {
      return null;
    }
    const base =
      check?.metadata && typeof check.metadata === 'object'
        ? { ...(check.metadata as Record<string, unknown>) }
        : {};
    let mutated = false;

    if (fields.tripleTemps) {
      const readings = pieceTemps
        .map((value, idx) => {
          const trimmed = value.trim();
          if (!trimmed) return null;
          const num = Number(trimmed);
          if (!Number.isFinite(num)) return null;
          return { label: `Piece ${idx + 1}`, tempC: num };
        })
        .filter((entry): entry is { label: string; tempC: number } => Boolean(entry));
      if (readings.length > 0) {
        base['readings'] = readings;
      } else {
        delete base['readings'];
      }
      mutated = true;
    }

    if (fields.dryingRun) {
      const ovenValue = ovenTemp.trim() ? Number(ovenTemp) : null;
      const startIso = toIsoFromLocalInput(dryingStart);
      const endIso = toIsoFromLocalInput(dryingEnd);
      if (ovenValue != null || startIso || endIso) {
        base['drying_run'] = {
          oven_temp_c: ovenValue,
          start_iso: startIso,
          end_iso: endIso,
        };
      } else {
        delete base['drying_run'];
      }
      mutated = true;
    }

    return mutated ? base : null;
  };

  const buildPayload = (nextStatus: QAStatus): Partial<QACheck> => {
    const payload: Partial<QACheck> = {
      temperature_c: fields.temperature ? (temperature !== '' ? Number(temperature) : null) : null,
      humidity_percent: fields.humidity ? (humidity !== '' ? Number(humidity) : null) : null,
      ph_level: fields.ph ? (ph !== '' ? Number(ph) : null) : null,
      water_activity: fields.aw ? (aw !== '' ? Number(aw) : null) : null,
      notes: fields.notes ? (notes.trim() ? notes : null) : null,
      corrective_action: nextStatus === 'failed' ? (action.trim() ? action : null) : null,
    };

    if (fields.tripleTemps) {
      const numericTemps = pieceTemps
        .map((value) => (value.trim() ? Number(value) : null))
        .filter((value): value is number => Number.isFinite(value));
      if (numericTemps.length > 0) {
        payload.temperature_c = Math.max(...numericTemps);
      }
    }

    const metadataPayload = buildMetadataPayload();
    if (metadataPayload !== null) {
      payload.metadata = metadataPayload;
    }

    return payload;
  };

  const save = () => {
    const err = validateIfPassing(status);
    if (err) {
      toast.error(err);
      setExpanded(true);
      return;
    }
    onChange(status, buildPayload(status));
    setExpanded(false);
  };

  const quickPass = () => {
    // Validate quickly; if a value is required, open details
    if (validateIfPassing('passed')) {
      setExpanded(true);
      return;
    }
    onChange('passed', buildPayload('passed'));
  };

  const quickFail = () => {
    // Encourage corrective action on fail
    setExpanded(true);
    onChange('failed', buildPayload('failed'));
  };

  const quickSkip = () => onChange('skipped', buildPayload('skipped'));

  const updatePieceTemp = (index: 0 | 1 | 2, value: string) => {
    setPieceTemps((prev) => {
      const next = [...prev] as [string, string, string];
      next[index] = value;
      return next;
    });
  };

  return (
    <div
      className={`rounded-xl border-2 bg-white transition ${
        status === 'passed'
          ? 'border-green-500'
          : status === 'failed'
          ? 'border-red-500'
          : status === 'conditional'
          ? 'border-yellow-500'
          : 'border-gray-200'
      }`}
    >
      <div className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-semibold">
                {checkpoint.code} - {checkpoint.name}
              </h3>
              {checkpoint.required && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">Required</span>
              )}
              {fields.temperature && (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Temperature</span>
              )}
              {fields.humidity && (
                <span className="rounded bg-teal-100 px-2 py-0.5 text-xs text-teal-700">Humidity</span>
              )}
              {fields.ph && (
                <span className="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700">pH</span>
              )}
              {fields.aw && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Water Activity</span>
              )}
              {fields.tripleTemps && (
                <span className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700">3 Temps</span>
              )}
              {fields.dryingRun && (
                <span className="rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-700">Drying Run</span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-600">{checkpoint.description}</p>

            {fields.managedExternally && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                This checkpoint is managed in the Beef Receiving flow. Record there; status can be synced here.
              </div>
            )}

            {check?.checked_at && (
              <p className="mt-2 text-xs text-gray-500">
                Checked by {check.checked_by ?? '-'} on {new Date(check.checked_at).toLocaleString()}
              </p>
            )}
          </div>

          {!fields.managedExternally && (
            <div className="flex flex-wrap items-center gap-2 justify-end sm:justify-end lg:justify-start">
              <button
                onClick={quickPass}
                className={`flex-1 min-w-[90px] sm:flex-none rounded-lg px-3 py-2 text-sm font-medium transition ${
                  status === 'passed' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                Pass
              </button>
              <button
                onClick={quickFail}
                className={`flex-1 min-w-[90px] sm:flex-none rounded-lg px-3 py-2 text-sm font-medium transition ${
                  status === 'failed' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                Fail
              </button>
              <button
                onClick={quickSkip}
                className={`flex-1 min-w-[90px] sm:flex-none rounded-lg px-3 py-2 text-sm font-medium transition ${
                  status === 'skipped' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title="Mark as not applicable / skipped"
              >
                Skip
              </button>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex-1 min-w-[90px] sm:flex-none rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                title="Toggle details"
              >
                {expanded ? 'Hide' : 'Show'}
              </button>
            </div>
          )}
        </div>

        {!fields.managedExternally && expanded && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {fields.temperature && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Temperature (deg C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              )}
              {fields.humidity && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Humidity (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={humidity}
                    onChange={(e) => setHumidity(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              )}
              {fields.ph && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">pH</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ph}
                    onChange={(e) => setPh(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              )}
              {fields.aw && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Water Activity (aw)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={aw}
                    onChange={(e) => setAw(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              )}
            </div>

            {fields.tripleTemps && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-3">
                <p className="text-sm font-medium text-gray-700">Cooking temperature checks (3 pieces)</p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {(['Piece 1', 'Piece 2', 'Piece 3'] as const).map((label, idx) => (
                    <div key={label}>
                      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
                      <input
                        type="number"
                        step="0.1"
                        value={pieceTemps[idx]}
                        onChange={(e) => updatePieceTemp(idx as 0 | 1 | 2, e.target.value)}
                        className="w-full rounded-lg border px-3 py-2"
                        placeholder="deg C"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fields.dryingRun && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Drying oven temp (deg C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={ovenTemp}
                    onChange={(e) => setOvenTemp(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                    placeholder="e.g. 70"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Drying start time</label>
                  <input
                    type="datetime-local"
                    value={dryingStart}
                    onChange={(e) => setDryingStart(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Drying finish time</label>
                  <input
                    type="datetime-local"
                    value={dryingEnd}
                    onChange={(e) => setDryingEnd(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>
              </div>
            )}

            {fields.notes && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="Optional notes..."
                />
              </div>
            )}

            {status === 'failed' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-red-700">Corrective Action *</label>
                <textarea
                  rows={2}
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full rounded-lg border-2 border-red-300 px-3 py-2"
                  placeholder="What corrective action was taken?"
                />
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 sm:flex-nowrap">
              <button onClick={() => setExpanded(false)} className="w-full rounded-lg border px-4 py-2 hover:bg-gray-50 sm:w-auto">
                Cancel
              </button>
              <button onClick={save} className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white hover:bg-gray-800 sm:w-auto">
                Save details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
