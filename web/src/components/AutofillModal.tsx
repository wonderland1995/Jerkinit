'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import {
  AUTOFILL_EXTRA_DATE_FIELDS,
  AUTOFILL_SECTION_LABELS,
  generateAutofillDefaults,
  localDatetimeInputValue,
  type AutofillExtraDates,
  type AutofillResult,
  type AutofillSection,
} from '@/lib/autofillDefaults';

export type AutofillModalProps = {
  isOpen: boolean;
  onClose: () => void;
  section: AutofillSection;
  /** Override the default section title */
  sectionLabel?: string;
  /** Pre-fill operator when known */
  defaultOperator?: string;
  /** Pre-fill activity datetime (datetime-local) */
  defaultCompletedAt?: string;
  /** Task code for refined generators (e.g. MICRO-LISTERIA) */
  taskCode?: string | null;
  onConfirm: (result: AutofillResult) => void;
};

export default function AutofillModal({
  isOpen,
  onClose,
  section,
  sectionLabel,
  defaultOperator = '',
  defaultCompletedAt,
  taskCode,
  onConfirm,
}: AutofillModalProps) {
  const [completedAt, setCompletedAt] = useState(() => defaultCompletedAt ?? localDatetimeInputValue());
  const [operatorName, setOperatorName] = useState(defaultOperator);
  const [extraDates, setExtraDates] = useState<AutofillExtraDates>({});
  const [error, setError] = useState<string | null>(null);

  const extraFields = AUTOFILL_EXTRA_DATE_FIELDS[section];
  const title = sectionLabel ?? AUTOFILL_SECTION_LABELS[section];

  const initialExtraDates = useMemo(() => {
    const seed = defaultCompletedAt ?? localDatetimeInputValue();
    const next: AutofillExtraDates = {};
    for (const field of AUTOFILL_EXTRA_DATE_FIELDS[section]) {
      next[field.key] = seed;
    }
    return next;
  }, [section, defaultCompletedAt]);

  useEffect(() => {
    if (!isOpen) return;
    setCompletedAt(defaultCompletedAt ?? localDatetimeInputValue());
    setOperatorName(defaultOperator);
    setExtraDates(initialExtraDates);
    setError(null);
  }, [isOpen, defaultCompletedAt, defaultOperator, initialExtraDates]);

  if (!isOpen) return null;

  const handleExtraDateChange = (key: keyof AutofillExtraDates, value: string) => {
    setExtraDates((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!completedAt) {
      setError('Date/time of activity is required.');
      return;
    }
    if (!operatorName.trim()) {
      setError('Operator name is required.');
      return;
    }
    setError(null);

    const result = generateAutofillDefaults(section, {
      completedAt,
      operatorName: operatorName.trim(),
      extraDates,
      taskCode,
    });
    onConfirm(result);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Sparkles className="h-6 w-6 text-blue-600" />
          </div>

          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-900">Autofill form</h3>
            <p className="mt-2 text-sm text-gray-600">
              Prefill <span className="font-semibold text-gray-900">{title}</span> with
              NSW Food Safety pass-range values. You can edit any field before submitting.
            </p>
          </div>

          <form onSubmit={handleConfirm} className="mt-5 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Date/time of activity <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={completedAt}
                onChange={(e) => setCompletedAt(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Backdate if logging a past activity.</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Operator name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                placeholder="Operator name"
                required
              />
            </div>

            {extraFields.length > 0 && (
              <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Section dates
                </p>
                {extraFields.map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {field.label}
                    </label>
                    <input
                      type="datetime-local"
                      value={extraDates[field.key] ?? ''}
                      onChange={(e) => handleExtraDateChange(field.key, e.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                    />
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Sparkles className="h-4 w-4" />
                Autofill
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
