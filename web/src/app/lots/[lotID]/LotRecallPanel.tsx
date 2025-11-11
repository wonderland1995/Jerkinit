'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import RecallModal from '@/components/RecallModal';
import { useToast } from '@/components/ToastProvider';

interface LotRecallPanelProps {
  lotId: string;
  lotLabel: string;
  isRecalled: boolean;
  recallReason?: string | null;
  recallNotes?: string | null;
}

export default function LotRecallPanel({
  lotId,
  lotLabel,
  isRecalled,
  recallReason,
  recallNotes,
}: LotRecallPanelProps) {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (reason: string, notes: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lots/${lotId}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, notes }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Failed to recall lot');
      }
      toast.success('Lot marked as recalled.');
      setModalOpen(false);
      setTimeout(() => {
        window.location.reload();
      }, 500);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to recall lot.';
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-purple-100 p-2 text-purple-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-purple-900">
              {isRecalled ? 'Lot recalled' : 'Lot is eligible for recall'}
            </p>
            {isRecalled ? (
              <>
                {recallReason && <p className="text-sm text-purple-800 mt-1">{recallReason}</p>}
                {recallNotes && <p className="text-xs text-purple-700 mt-1">{recallNotes}</p>}
              </>
            ) : (
              <p className="text-sm text-purple-800 mt-1">
                Triggering a recall will automatically flag every batch that used this lot.
              </p>
            )}
            {!isRecalled && (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
              >
                <Loader2 className={`h-4 w-4 ${loading ? 'animate-spin' : 'hidden'}`} />
                {loading ? 'Working...' : 'Initiate recall'}
              </button>
            )}
          </div>
        </div>
      </div>

      <RecallModal
        isOpen={modalOpen}
        onClose={() => {
          if (!loading) {
            setModalOpen(false);
            setError(null);
          }
        }}
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        entityLabel={`Lot ${lotLabel}`}
        title="Recall lot"
        description="This will mark the lot as recalled and cascade the status to every batch that used it."
        confirmLabel="Confirm recall"
      />
    </>
  );
}
