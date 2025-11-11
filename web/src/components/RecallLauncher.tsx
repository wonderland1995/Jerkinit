'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';

type RecallType = 'lot' | 'batch';
type MaterialCategory = 'all' | 'beef' | 'spice' | 'packaging' | 'additive' | 'other';

interface RecallLauncherProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SearchOption {
  id: string;
  label: string;
  description?: string | null;
  meta?: string | null;
}

const CATEGORY_OPTIONS: Array<{ value: MaterialCategory; label: string }> = [
  { value: 'all', label: 'All materials' },
  { value: 'beef', label: 'Beef' },
  { value: 'spice', label: 'Spices' },
  { value: 'additive', label: 'Additives' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'other', label: 'Other' },
];

export default function RecallLauncher({ open, onClose, onSuccess }: RecallLauncherProps) {
  const toast = useToast();
  const [recallType, setRecallType] = useState<RecallType>('lot');
  const [lotCategory, setLotCategory] = useState<MaterialCategory>('beef');
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchReady = searchTerm.trim().length >= 2;

  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setOptions([]);
      setSelectedId(null);
      setReason('');
      setNotes('');
      setError(null);
      return;
    }
  }, [open, recallType]);

  useEffect(() => {
    if (!open || !searchReady) {
      setOptions([]);
      return;
    }

    const controller = new AbortController();
    const fetchOptions = async () => {
      try {
        setSearching(true);
        const query = recallType === 'lot'
          ? `/api/lots?q=${encodeURIComponent(searchTerm)}${
              lotCategory !== 'all' ? `&category=${lotCategory}` : ''
            }`
          : `/api/batches/search?q=${encodeURIComponent(searchTerm)}`;
        const res = await fetch(query, { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to load search results');
        const data = (await res.json()) as Record<string, unknown>;
        if (recallType === 'lot') {
          const lots = Array.isArray((data as { lots?: unknown[] }).lots)
            ? ((data as { lots?: Array<Record<string, unknown>> }).lots ?? [])
            : [];
          setOptions(
            lots.map((lot) => {
              const materialRel = lot.material;
              const material = Array.isArray(materialRel) ? materialRel[0] : materialRel;
              return {
                id: String(lot.id),
                label: `Lot ${lot.lot_number ?? lot.internal_lot_code ?? 'Unknown'}`,
                description: material?.name ?? 'Unknown material',
                meta:
                  typeof lot.current_balance === 'number'
                    ? `${Number(lot.current_balance).toFixed(0)} ${lot.unit ?? 'g'}`
                    : null,
              };
            }),
          );
        } else {
          const batches = Array.isArray((data as { batches?: unknown[] }).batches)
            ? ((data as { batches?: Array<Record<string, unknown>> }).batches ?? [])
            : [];
          setOptions(
            batches.map((batch) => ({
              id: String(batch.id),
              label: batch.batch_id ?? 'Batch',
              description: batch.product_name ?? 'Unknown product',
              meta: batch.status ?? null,
            })),
          );
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        console.error(err);
      } finally {
        setSearching(false);
      }
    };

    void fetchOptions();
    return () => controller.abort();
  }, [open, recallType, lotCategory, searchTerm, searchReady]);

  const canSubmit = useMemo(() => {
    return Boolean(selectedId && reason.trim().length > 0);
  }, [selectedId, reason]);

  const handleSubmit = async () => {
    if (!selectedId || !canSubmit) {
      setError('Select a target and provide a reason.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const endpoint =
        recallType === 'lot'
          ? `/api/lots/${selectedId}/recall`
          : `/api/batches/${selectedId}/recall`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), notes: notes.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Failed to initiate recall');
      }
      toast.success('Recall initiated.');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate recall.');
      toast.error(err instanceof Error ? err.message : 'Failed to initiate recall.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && onClose()} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
          <div className="flex items-center gap-3 border-b pb-3">
            <div className="rounded-full bg-purple-100 p-2 text-purple-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Initiate Recall</h3>
              <p className="text-sm text-gray-500">
                Select a lot or batch and record the reason. Downstream data will update automatically.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Recall type</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(['lot', 'batch'] as RecallType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setRecallType(type);
                      setSelectedId(null);
                      setSearchTerm('');
                      setOptions([]);
                    }}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                      recallType === type
                        ? 'border-purple-500 bg-purple-50 text-purple-800'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {type === 'lot' ? 'Material / Lot recall' : 'Batch recall'}
                  </button>
                ))}
              </div>
            </div>

            {recallType === 'lot' && (
              <div className="grid gap-3 md:grid-cols-[160px,1fr]">
                <div>
                  <label className="text-xs font-medium text-gray-500">Material category</label>
                  <select
                    value={lotCategory}
                    onChange={(e) => setLotCategory(e.target.value as MaterialCategory)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Search lot</label>
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="e.g. LOT-241, supplier, material..."
                  />
                  <p className="mt-1 text-xs text-gray-500">Minimum 2 characters to search.</p>
                </div>
              </div>
            )}

            {recallType === 'batch' && (
              <div>
                <label className="text-xs font-medium text-gray-500">Search batch</label>
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Batch ID or product name"
                />
                <p className="mt-1 text-xs text-gray-500">Minimum 2 characters to search.</p>
              </div>
            )}

            {searchReady && (
              <div className="rounded-lg border bg-gray-50 p-3">
                {searching ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </div>
                ) : options.length === 0 ? (
                  <p className="text-sm text-gray-500">No matches.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {options.map((option) => {
                      const active = selectedId === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedId(option.id)}
                          className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                            active
                              ? 'border-purple-500 bg-white shadow-sm'
                              : 'border-transparent bg-white hover:border-gray-200'
                          }`}
                        >
                          <p className="font-semibold text-gray-900">{option.label}</p>
                          {option.description && (
                            <p className="text-xs text-gray-500">{option.description}</p>
                          )}
                          {option.meta && <p className="text-xs text-gray-400">{option.meta}</p>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Recall reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Pathogen detection, packaging failure, supplier alert..."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Notes (optional)</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Corrective actions, contacts notified..."
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              disabled={submitting || !canSubmit}
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Record recall'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
