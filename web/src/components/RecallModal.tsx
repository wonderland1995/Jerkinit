'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface RecallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, notes: string) => Promise<boolean>;
  loading: boolean;
  error?: string | null;
  entityLabel: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
}

export default function RecallModal({
  isOpen,
  onClose,
  onSubmit,
  loading,
  error,
  entityLabel,
  title = 'Recall',
  description = 'Provide context for the recall so downstream teams know what to do next.',
  confirmLabel = 'Confirm recall',
}: RecallModalProps) {
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
            <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
            <p className="mt-2 text-sm text-gray-600">
              You are about to mark{' '}
              <span className="font-mono font-semibold text-gray-900">{entityLabel}</span> as
              recalled. {description}
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
                placeholder="Describe why this recall is being initiated..."
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
                placeholder="Add follow-up actions, customer targets, or corrective measures..."
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
                  confirmLabel
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
