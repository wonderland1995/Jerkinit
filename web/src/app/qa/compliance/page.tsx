'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileUp,
  History,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import type { ComplianceLog, ComplianceTaskWithStatus } from '@/types/compliance';
import { formatDate, formatDateTime } from '@/lib/utils';
import { useToast } from '@/components/ToastProvider';

type LogFormState = {
  completed_at: string;
  completed_by: string;
  scope: string;
  result: string;
  notes: string;
  batches_covered: string;
  batch_start: string;
  batch_end: string;
};

const statusStyles: Record<
  ComplianceTaskWithStatus['status'],
  { label: string; className: string }
> = {
  not_started: { label: 'Not started', className: 'bg-gray-100 text-gray-700' },
  on_track: { label: 'On track', className: 'bg-emerald-100 text-emerald-700' },
  due_soon: { label: 'Due soon', className: 'bg-amber-100 text-amber-700' },
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-700' },
  batch_due: { label: 'Due (batches)', className: 'bg-orange-100 text-orange-700' },
};

const localDateInputValue = (date = new Date()) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

const defaultFormState = (): LogFormState => ({
  completed_at: localDateInputValue(),
  completed_by: '',
  scope: '',
  result: '',
  notes: '',
  batches_covered: '',
  batch_start: '',
  batch_end: '',
});

export default function GeneralCompliancePage() {
  const toast = useToast();
  const [tasks, setTasks] = useState<ComplianceTaskWithStatus[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [logs, setLogs] = useState<ComplianceLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [form, setForm] = useState<LogFormState>(() => defaultFormState());
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  const metadataRecord =
    selectedTask?.metadata && typeof selectedTask.metadata === 'object'
      ? (selectedTask.metadata as Record<string, unknown>)
      : null;

  const requiresBatches = Boolean(metadataRecord?.['requires_batches']);

  const scopeLabel =
    (metadataRecord && typeof metadataRecord['scope_label'] === 'string'
      ? (metadataRecord['scope_label'] as string)
      : null) ||
    'Area / equipment covered';

  const notesHint =
    (metadataRecord && typeof metadataRecord['notes_hint'] === 'string'
      ? (metadataRecord['notes_hint'] as string)
      : null) ||
    'Observations, lab reference, or corrective action';

  const resultLabel =
    (metadataRecord && typeof metadataRecord['result_label'] === 'string'
      ? (metadataRecord['result_label'] as string)
      : null) ||
    'Result / outcome';

  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const res = await fetch('/api/compliance/tasks', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load tasks');
      const data = (await res.json()) as { tasks: ComplianceTaskWithStatus[] };
      const list = Array.isArray(data.tasks) ? data.tasks : [];
      setTasks(list);
      if (list.length === 0) {
        setSelectedTaskId(null);
      } else if (!selectedTaskId || !list.some((task) => task.id === selectedTaskId)) {
        setSelectedTaskId(list[0].id);
      }
    } catch (error) {
      console.error(error);
      toast.error('Unable to load compliance tasks.');
    } finally {
      setLoadingTasks(false);
    }
  }, [selectedTaskId, toast]);

  const fetchLogs = useCallback(
    async (taskId: string) => {
      setLoadingLogs(true);
      try {
        const res = await fetch(`/api/compliance/logs?taskId=${taskId}&limit=50`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to load logs');
        const data = (await res.json()) as { logs: ComplianceLog[] };
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      } catch (error) {
        console.error(error);
        toast.error('Unable to load log history.');
      } finally {
        setLoadingLogs(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (selectedTaskId) {
      void fetchLogs(selectedTaskId);
      setForm(defaultFormState());
      setProofFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } else {
      setLogs([]);
    }
  }, [selectedTaskId, fetchLogs]);

  const handleFormChange = (field: keyof LogFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTask) {
      toast.error('Select a task first.');
      return;
    }

    setSaving(true);
    try {
      const payload = new FormData();
      payload.append('task_id', selectedTask.id);
      if (form.completed_at) {
        const parsed = new Date(form.completed_at);
        if (!Number.isNaN(parsed.getTime())) {
          const corrected = new Date(parsed.getTime() + parsed.getTimezoneOffset() * 60000);
          payload.append('completed_at', corrected.toISOString());
        }
      }
      if (form.completed_by) payload.append('completed_by', form.completed_by);
      if (form.scope) payload.append('scope', form.scope);
      if (form.result) payload.append('result', form.result);
      if (form.notes) payload.append('notes', form.notes);
      if (requiresBatches && form.batches_covered) {
        payload.append('batches_covered', form.batches_covered);
      }
      if (requiresBatches && form.batch_start) payload.append('batch_start', form.batch_start);
      if (requiresBatches && form.batch_end) payload.append('batch_end', form.batch_end);
      if (proofFile) payload.append('proof', proofFile);

      const res = await fetch('/api/compliance/logs', {
        method: 'POST',
        body: payload,
      });

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errorBody.error ?? 'Failed to save record');
      }

      toast.success('Compliance record saved.');
      setForm(defaultFormState());
      setProofFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await Promise.all([fetchLogs(selectedTask.id), fetchTasks()]);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : 'Failed to save record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-5">
          <Link href="/qa" className="text-sm text-blue-600 hover:text-blue-700">
            {'< Back to QA'}
          </Link>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-600/10 p-3 text-blue-700">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">General Compliance</h1>
                <p className="text-gray-600">
                  Track prerequisite programs, environmental monitoring, and microbiological
                  verification with mandatory proof uploads.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900">
              <p className="font-semibold">Prerequisite program scope</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>Environmental monitoring for Listeria: swab food contact surfaces weekly.</li>
                <li>Environmental monitoring for Listeria: swab non-food contact surfaces fortnightly.</li>
                <li>Micro testing every 10 finished batches for Listeria, E. coli, and Salmonella.</li>
              </ul>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:grid-cols-[1fr,1.2fr] sm:px-5">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Program status</h2>
            <button
              type="button"
              onClick={() => fetchTasks()}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Refresh
            </button>
          </div>

          {loadingTasks ? (
            <div className="rounded-xl border bg-white p-6 text-center text-gray-500">
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-center text-gray-500">
              No compliance tasks configured.
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => {
                const status = statusStyles[task.status];
                const isActive = task.id === selectedTaskId;
                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isActive ? 'border-blue-500 bg-blue-50/50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm uppercase tracking-wide text-gray-500">{task.category}</p>
                        <h3 className="text-lg font-semibold text-gray-900">{task.name}</h3>
                        <p className="text-sm text-gray-600">{task.description}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">Last completion</p>
                          <p>{task.latest_log?.completed_at ? formatDate(task.latest_log.completed_at, true) : 'Never logged'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500">
                            {task.frequency_type === 'batch_interval' ? 'Batches since test' : 'Next due'}
                          </p>
                          {task.frequency_type === 'batch_interval' ? (
                            <p>
                              {task.batches_since_last ?? '–'}
                              {typeof task.batches_remaining === 'number'
                                ? ` (need ${Math.max(task.batches_remaining, 0)} more)`
                                : ''}
                            </p>
                          ) : (
                            <p>{task.next_due_at ? formatDate(task.next_due_at, true) : 'Set after first record'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            {!selectedTask ? (
              <p className="text-gray-500">Select a task to log activity and see history.</p>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Logging for</p>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedTask.name}</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Completed on *</label>
                    <input
                      type="datetime-local"
                      value={form.completed_at}
                      onChange={(e) => handleFormChange('completed_at', e.target.value)}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Completed by</label>
                    <input
                      type="text"
                      value={form.completed_by}
                      onChange={(e) => handleFormChange('completed_by', e.target.value)}
                      className="mt-1 w-full rounded-lg border px-3 py-2"
                      placeholder="Operator name"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">{scopeLabel}</label>
                  <input
                    type="text"
                    value={form.scope}
                    onChange={(e) => handleFormChange('scope', e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    placeholder="E.g. conveyors A/B, slicer line, drains..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">{resultLabel}</label>
                  <input
                    type="text"
                    value={form.result}
                    onChange={(e) => handleFormChange('result', e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    placeholder="Lab result, CFU, pass/fail, etc."
                  />
                </div>

                {requiresBatches && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Batches covered</label>
                      <input
                        type="number"
                        min={0}
                        value={form.batches_covered}
                        onChange={(e) => handleFormChange('batches_covered', e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        placeholder="10"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Batch start</label>
                      <input
                        type="text"
                        value={form.batch_start}
                        onChange={(e) => handleFormChange('batch_start', e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        placeholder="e.g. JERK-0240"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Batch end</label>
                      <input
                        type="text"
                        value={form.batch_end}
                        onChange={(e) => handleFormChange('batch_end', e.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2"
                        placeholder="e.g. JERK-0249"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    placeholder={notesHint}
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <FileUp className="h-4 w-4" />
                    Proof of completion {selectedTask.proof_required && <span className="text-red-600">*</span>}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-sm text-gray-600 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                    required={selectedTask.proof_required}
                  />
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(defaultFormState());
                      setProofFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Upload className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Upload proof'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-semibold text-gray-900">Recent records</h3>
              </div>
              {selectedTask && <span className="text-sm text-gray-500">{logs.length} entries</span>}
            </div>

            {loadingLogs ? (
              <p className="text-gray-500">Loading log history...</p>
            ) : logs.length === 0 ? (
              <p className="text-gray-500">No records logged yet.</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => {
                  const meta =
                    log.metadata && typeof log.metadata === 'object'
                      ? (log.metadata as Record<string, unknown>)
                      : null;
                  const scope =
                    meta && typeof meta['scope'] === 'string'
                      ? (meta['scope'] as string)
                      : null;
                  const batchWindow =
                    meta && typeof meta['batch_window'] === 'object' && meta['batch_window'] !== null
                      ? (meta['batch_window'] as { start?: string | null; end?: string | null })
                      : null;
                  const batchesCovered =
                    meta && typeof meta['batches_covered'] === 'number'
                      ? (meta['batches_covered'] as number)
                      : null;

                  return (
                    <div key={log.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          {formatDateTime(log.completed_at)}
                          {log.completed_by && <span className="text-gray-400">· {log.completed_by}</span>}
                        </div>
                        {log.proof_url && (
                          <a
                            href={log.proof_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-blue-600 hover:text-blue-700"
                          >
                            View proof
                          </a>
                        )}
                      </div>
                      <dl className="mt-2 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
                        {log.result && (
                          <div>
                            <dt className="text-xs uppercase text-gray-500">{resultLabel}</dt>
                            <dd className="font-medium text-gray-900">{log.result}</dd>
                          </div>
                        )}
                        {scope && (
                          <div>
                            <dt className="text-xs uppercase text-gray-500">{scopeLabel}</dt>
                            <dd>{String(scope)}</dd>
                          </div>
                        )}
                        {batchWindow && (batchWindow.start || batchWindow.end) && (
                          <div>
                            <dt className="text-xs uppercase text-gray-500">Batch window</dt>
                            <dd>
                              {(batchWindow.start ?? '–')}-{batchWindow.end ?? '–'}
                            </dd>
                          </div>
                        )}
                        {typeof batchesCovered === 'number' && (
                          <div>
                            <dt className="text-xs uppercase text-gray-500">Batches covered</dt>
                            <dd>{batchesCovered}</dd>
                          </div>
                        )}
                      </dl>
                      {log.notes && <p className="mt-2 text-sm text-gray-600">{log.notes}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
