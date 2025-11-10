'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  batchNumber: string;
}

export default function DeleteBatchModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  batchNumber 
}: DeleteBatchModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isConfirmValid = confirmText === batchNumber;

  const handleDelete = async () => {
    if (!isConfirmValid) return;

    setIsDeleting(true);
    setError('');

    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Delete batch failed', error);
      setError('Failed to delete batch. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setConfirmText('');
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
          {/* Close button */}
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>

          {/* Content */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Delete Batch
            </h3>
            <p className="text-gray-600 mb-4">
              This action cannot be undone. This will permanently delete batch{' '}
              <span className="font-mono font-semibold text-gray-900">
                {batchNumber}
              </span>{' '}
              and all associated QA records, ingredient data, and traceability information.
            </p>

            {/* Warning list */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm font-semibold text-amber-900 mb-2">
                This will delete:
              </p>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• All QA checkpoint records</li>
                <li>• Ingredient measurements</li>
                <li>• Lot traceability links</li>
                <li>• Product testing results</li>
                <li>• Release documentation</li>
              </ul>
            </div>

            {/* Confirmation input */}
            <div className="text-left">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <span className="font-mono font-bold">{batchNumber}</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={isDeleting}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100 disabled:cursor-not-allowed font-mono"
                placeholder={batchNumber}
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                {error}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!isConfirmValid || isDeleting}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Deleting...' : 'Delete Batch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
