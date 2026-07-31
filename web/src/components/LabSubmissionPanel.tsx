'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { FlaskConical, Loader2, Upload, X } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import { formatDateTime } from '@/lib/utils';
import { localDatetimeInputValue } from '@/lib/autofillDefaults';

type LabMeta = {
  sample_id?: string | null;
  lab_name?: string | null;
  sent_iso?: string | null;
  result_iso?: string | null;
  result_aw?: number | string | null;
};

type LabCheck = {
  id?: string;
  status?: string | null;
  water_activity?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

type LabDoc = {
  id: string;
  file_url: string | null;
  file_name: string | null;
  uploaded_at: string;
  notes: string | null;
};

export type LabSubmissionPanelProps = {
  batchId: string;
  batchCode: string;
  checkpointId: string | null;
  check: LabCheck | undefined;
  labDocuments: LabDoc[];
  onRefresh: () => Promise<void>;
};

function extractLabMeta(check: LabCheck | undefined): LabMeta | null {
  const meta = check?.metadata;
  if (!meta || typeof meta !== 'object') return null;
  const lab = (meta as { lab_aw?: unknown }).lab_aw;
  if (!lab || typeof lab !== 'object') return null;
  return lab as LabMeta;
}

function toLocalInput(value?: string | null): string {
  if (!value) return '';
  const t = value.split('.')[0].replace('Z', '');
  return t.length >= 16 ? t.slice(0, 16) : t;
}

function toIsoFromLocal(value?: string): string | null {
  if (!value) return null;
  return `${value}:00`;
}

export default function LabSubmissionPanel({
  batchId,
  batchCode,
  checkpointId,
  check,
  labDocuments,
  onRefresh,
}: LabSubmissionPanelProps) {
  const toast = useToast();
  const [sendOpen, setSendOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sampleId, setSampleId] = useState('');
  const [labName, setLabName] = useState('External accredited lab');
  const [sentAt, setSentAt] = useState(localDatetimeInputValue());
  const [resultAt, setResultAt] = useState(localDatetimeInputValue());
  const [resultAw, setResultAw] = useState('');
  const [resultNotes, setResultNotes] = useState('');
  const [resultFile, setResultFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const labMeta = useMemo(() => extractLabMeta(check), [check]);
  const sent = Boolean(labMeta?.sent_iso);
  const hasResult =
    labMeta?.result_aw != null ||
    Boolean(labMeta?.result_iso) ||
    check?.water_activity != null ||
    labDocuments.length > 0;

  useEffect(() => {
    if (!sendOpen) return;
    setSampleId(labMeta?.sample_id ?? `${batchCode}-LAB`);
    setLabName(labMeta?.lab_name ?? 'External accredited lab');
    setSentAt(toLocalInput(labMeta?.sent_iso) || localDatetimeInputValue());
  }, [sendOpen, labMeta, batchCode]);

  useEffect(() => {
    if (!resultOpen) return;
    setResultAt(toLocalInput(labMeta?.result_iso) || localDatetimeInputValue());
    setResultAw(
      labMeta?.result_aw != null
        ? String(labMeta.result_aw)
        : check?.water_activity != null
          ? String(check.water_activity)
          : '',
    );
    setResultNotes('');
    setResultFile(null);
    if (fileRef.current) fileRef.current.value = '';
  }, [resultOpen, labMeta, check?.water_activity]);

  const statusLabel = !sent
    ? 'Not sent'
    : hasResult
      ? 'Result received'
      : 'Sent — awaiting result';

  const statusClass = !sent
    ? 'bg-gray-100 text-gray-700'
    : hasResult
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-amber-100 text-amber-800';

  const persistCheckpoint = async (body: Record<string, unknown>) => {
    if (!checkpointId) {
      throw new Error('Water activity lab checkpoint (DRY-FSP-AW-LAB) is not configured.');
    }
    const res = await fetch('/api/qa/checkpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batch_id: batchId,
        checkpoint_id: checkpointId,
        checked_by: 'Operator',
        ...body,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(j.error ?? 'Failed to update lab checkpoint');
    }
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!sampleId.trim() || !labName.trim() || !sentAt) {
      toast.error('Sample ID, lab name, and sent date are required.');
      return;
    }
    setSaving(true);
    try {
      const existingMeta =
        check?.metadata && typeof check.metadata === 'object'
          ? { ...(check.metadata as Record<string, unknown>) }
          : {};
      await persistCheckpoint({
        status: 'conditional',
        notes: `Sample sent to lab (${labName.trim()}). Awaiting result.`,
        metadata: {
          ...existingMeta,
          lab_aw: {
            sample_id: sampleId.trim(),
            lab_name: labName.trim(),
            sent_iso: toIsoFromLocal(sentAt),
            result_iso: labMeta?.result_iso ?? null,
            result_aw: labMeta?.result_aw ?? null,
          },
        },
      });
      toast.success('Batch marked as sent to lab.');
      setSendOpen(false);
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark sent to lab.');
    } finally {
      setSaving(false);
    }
  };

  const handleResult = async (event: FormEvent) => {
    event.preventDefault();
    if (!resultFile) {
      toast.error('Upload the lab result PDF or image.');
      return;
    }
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append('batch_id', batchId);
      payload.append('document_type_code', 'LAB-AW-RESULT');
      payload.append('document_number', `${batchCode}-LAB-${Date.now()}`);
      payload.append('status', 'approved');
      payload.append('file', resultFile);
      payload.append(
        'notes',
        [
          resultNotes.trim() || null,
          sampleId.trim() || labMeta?.sample_id
            ? `Sample: ${sampleId.trim() || labMeta?.sample_id}`
            : null,
          resultAw.trim() ? `Aw result: ${resultAw.trim()}` : null,
        ]
          .filter(Boolean)
          .join(' | ') || 'Lab result upload',
      );

      const docRes = await fetch('/api/qa/documents', { method: 'POST', body: payload });
      if (!docRes.ok) {
        const body = (await docRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Failed to upload lab result');
      }

      const awValue = resultAw.trim() !== '' ? Number(resultAw) : null;
      const passed = awValue == null ? true : awValue < 0.85;
      const existingMeta =
        check?.metadata && typeof check.metadata === 'object'
          ? { ...(check.metadata as Record<string, unknown>) }
          : {};
      const priorLab = extractLabMeta(check);

      await persistCheckpoint({
        status: passed ? 'passed' : 'failed',
        water_activity: awValue,
        notes: passed
          ? `Lab result received. Aw ${awValue ?? 'recorded'} (< 0.85).`
          : `Lab result received. Aw ${awValue} exceeds 0.85 limit.`,
        corrective_action: passed ? null : 'Hold batch pending QA review of Aw failure.',
        metadata: {
          ...existingMeta,
          lab_aw: {
            sample_id: priorLab?.sample_id ?? (sampleId.trim() || `${batchCode}-LAB`),
            lab_name: priorLab?.lab_name ?? (labName.trim() || 'External accredited lab'),
            sent_iso: priorLab?.sent_iso ?? toIsoFromLocal(sentAt),
            result_iso: toIsoFromLocal(resultAt),
            result_aw: awValue,
          },
        },
      });

      toast.success(passed ? 'Lab result uploaded and recorded.' : 'Lab result uploaded — Aw failed limit.');
      setResultOpen(false);
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload lab result.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-indigo-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">External lab</p>
              <h2 className="text-lg font-semibold text-gray-900">Send to lab / upload result</h2>
              <p className="mt-1 text-sm text-gray-600">
                Mark this batch as submitted for lab verification (typically every 3 months), then upload the
                certificate when it returns.
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>
            {statusLabel}
          </span>
        </div>

        <dl className="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Sample ID</dt>
            <dd className="font-medium text-gray-900">{labMeta?.sample_id ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Lab</dt>
            <dd>{labMeta?.lab_name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Sent</dt>
            <dd>{labMeta?.sent_iso ? formatDateTime(labMeta.sent_iso) : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-gray-500">Result / Aw</dt>
            <dd>
              {labMeta?.result_iso ? formatDateTime(labMeta.result_iso) : '—'}
              {labMeta?.result_aw != null || check?.water_activity != null
                ? ` · Aw ${labMeta?.result_aw ?? check?.water_activity}`
                : ''}
            </dd>
          </div>
        </dl>

        {labDocuments.length > 0 && (
          <div className="mt-3 space-y-2">
            {labDocuments.map((doc) => (
              <a
                key={doc.id}
                href={doc.file_url ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50"
              >
                {doc.file_name ?? 'Lab result'} · {formatDateTime(doc.uploaded_at)}
              </a>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSendOpen(true)}
            disabled={!checkpointId}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            <FlaskConical className="h-4 w-4" />
            {sent ? 'Update send details' : 'Send to lab'}
          </button>
          <button
            type="button"
            onClick={() => setResultOpen(true)}
            disabled={!checkpointId}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            Upload lab result
          </button>
        </div>
        {!checkpointId && (
          <p className="mt-2 text-xs text-amber-700">
            DRY-FSP-AW-LAB checkpoint is missing — configure QA checkpoints to enable lab tracking.
          </p>
        )}
      </div>

      {sendOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setSendOpen(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <form
              onSubmit={handleSend}
              className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setSendOpen(false)}
                disabled={saving}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-xl font-semibold text-gray-900">Send batch to lab</h3>
              <p className="mt-1 text-sm text-gray-600">
                Records that <span className="font-mono font-semibold">{batchCode}</span> has been submitted for
                external testing.
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Sample ID *</label>
                  <input
                    value={sampleId}
                    onChange={(e) => setSampleId(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Lab name *</label>
                  <input
                    value={labName}
                    onChange={(e) => setLabName(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Sent at *</label>
                  <input
                    type="datetime-local"
                    value={sentAt}
                    onChange={(e) => setSentAt(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSendOpen(false)}
                  disabled={saving}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Confirm sent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resultOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setResultOpen(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <form
              onSubmit={handleResult}
              className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setResultOpen(false)}
                disabled={saving}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-xl font-semibold text-gray-900">Upload lab result</h3>
              <p className="mt-1 text-sm text-gray-600">
                Attach the certificate and optionally enter the Aw reading (pass &lt; 0.85).
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Result file *</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setResultFile(e.target.files?.[0] ?? null)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Result received</label>
                  <input
                    type="datetime-local"
                    value={resultAt}
                    onChange={(e) => setResultAt(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Water activity (aw)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={resultAw}
                    onChange={(e) => setResultAw(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="e.g. 0.82"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    rows={2}
                    value={resultNotes}
                    onChange={(e) => setResultNotes(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Optional lab comments..."
                  />
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setResultOpen(false)}
                  disabled={saving}
                  className="flex-1 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !resultFile}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {saving ? 'Uploading...' : 'Upload result'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
