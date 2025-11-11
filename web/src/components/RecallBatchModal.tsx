'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface RecallBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, notes: string) => Promise<boolean>;
  loading: boolean;
  error?: string | null;
  batchNumber: string;
}

export default function RecallBatchModal({
  isOpen,
  onClose,
  onSubmit,
  loading,
  error,
  batchNumber,
}: RecallBatchModalProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setReason('');
      setNotes('');
      setLocalError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason.trim()) {
      setLocalError('Please provide a recall reason.');
      return;
    }
    setLocalError(null);
    const success = await onSubmit(reason.trim(), notes.trim());
    if (success) {
      setReason('');
      setNotes('');
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
            <AlertTriangle className="h-6 w-6 text-purple-600" />
          </div>

          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-900">Recall batch</h3>
            <p className="mt-2 text-sm text-gray-600">
              You are about to mark batch{' '}
              <span className="font-mono font-semibold text-gray-900">{batchNumber}</span> as
              recalled. This will alert downstream reports and prevent the batch from being released
              again until issues are resolved.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Recall reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/60"
                placeholder="Describe why this batch needs to be recalled..."
                disabled={loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notes (optional)</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/60"
                placeholder="Add any follow-up actions, customer details, or corrective measures..."
                disabled={loading}
              />
            </div>

            {(localError || error) && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {localError ?? error}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Confirm recall'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
