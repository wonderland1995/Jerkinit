'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import {
  AUTOFILL_EXTRA_DATE_FIELDS,
  AUTOFILL_SECTION_LABELS,
  generateAutofillDefaults,
  generateBatchQaAutofill,
  generateJerkyWeekendSchedule,
  localDatetimeInputValue,
  mostRecentFridayDate,
  type AutofillExtraDates,
  type AutofillResult,
  type AutofillSection,
  type BatchQaAutofillResult,
} from '@/lib/autofillDefaults';

type SectionModeProps = {
  mode?: 'section';
  section: AutofillSection;
  sectionLabel?: string;
  taskCode?: string | null;
  onConfirm: (result: AutofillResult) => void;
  defaultWetWeightKg?: never;
};

type BatchModeProps = {
  mode: 'batch';
  section?: never;
  sectionLabel?: string;
  taskCode?: never;
  /** Prefill from beef + recipe ingredient fills */
  defaultWetWeightKg?: number | null;
  onConfirm: (result: BatchQaAutofillResult) => void;
};

export type AutofillModalProps = {
  isOpen: boolean;
  onClose: () => void;
  defaultOperator?: string;
  defaultCompletedAt?: string;
} & (SectionModeProps | BatchModeProps);

function formatPreviewLocal(value: string): string {
  if (!value) return '—';
  const d = new Date(value.length === 16 ? `${value}:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AutofillModal(props: AutofillModalProps) {
  const {
    isOpen,
    onClose,
    defaultOperator = '',
    defaultCompletedAt,
    sectionLabel,
  } = props;
  const mode = props.mode ?? 'section';
  const section = mode === 'section' ? props.section : null;
  const defaultWetWeightKg = mode === 'batch' ? props.defaultWetWeightKg : null;

  const [completedAt, setCompletedAt] = useState(() => defaultCompletedAt ?? localDatetimeInputValue());
  const [operatorName, setOperatorName] = useState(defaultOperator);
  const [extraDates, setExtraDates] = useState<AutofillExtraDates>({});
  const [fridayDate, setFridayDate] = useState(mostRecentFridayDate());
  const [wetWeightKg, setWetWeightKg] = useState('');
  const [error, setError] = useState<string | null>(null);

  const title =
    sectionLabel ??
    (mode === 'batch' ? 'Entire batch QA' : section ? AUTOFILL_SECTION_LABELS[section] : 'Form');

  const schedulePreview = useMemo(
    () => (mode === 'batch' && fridayDate ? generateJerkyWeekendSchedule(fridayDate) : null),
    [mode, fridayDate, isOpen],
  );

  const wetPreview = Number(wetWeightKg);
  const lossPreview = 56;
  const dryPreview =
    Number.isFinite(wetPreview) && wetPreview > 0
      ? Math.round(wetPreview * (1 - lossPreview / 100) * 1000) / 1000
      : null;

  const initialExtraDates = useMemo(() => {
    const seed = defaultCompletedAt ?? localDatetimeInputValue();
    const next: AutofillExtraDates = {};
    if (mode === 'section' && section) {
      for (const field of AUTOFILL_EXTRA_DATE_FIELDS[section]) {
        next[field.key] = seed;
      }
    }
    return next;
  }, [mode, section, defaultCompletedAt]);

  useEffect(() => {
    if (!isOpen) return;
    setCompletedAt(defaultCompletedAt ?? localDatetimeInputValue());
    setOperatorName(defaultOperator);
    setExtraDates(initialExtraDates);
    setFridayDate(mostRecentFridayDate());
    const wet =
      mode === 'batch' && defaultWetWeightKg != null && defaultWetWeightKg > 0
        ? String(Math.round(defaultWetWeightKg * 1000) / 1000)
        : '';
    setWetWeightKg(wet);
    setError(null);
  }, [isOpen, defaultCompletedAt, defaultOperator, initialExtraDates, mode, defaultWetWeightKg]);

  if (!isOpen) return null;

  const handleExtraDateChange = (key: keyof AutofillExtraDates, value: string) => {
    setExtraDates((prev) => ({ ...prev, [key]: value }));
  };

  const handleConfirm = (event: React.FormEvent) => {
    event.preventDefault();
    if (!operatorName.trim()) {
      setError('Operator name is required.');
      return;
    }

    if (props.mode === 'batch') {
      if (!fridayDate) {
        setError('Production Friday date is required.');
        return;
      }
      const wet = Number(wetWeightKg);
      if (!Number.isFinite(wet) || wet <= 0) {
        setError('Wet weight (kg) from the recipe fill is required.');
        return;
      }
      setError(null);
      const batchProps = props as BatchModeProps & {
        isOpen: boolean;
        onClose: () => void;
      };
      batchProps.onConfirm(
        generateBatchQaAutofill({
          operatorName: operatorName.trim(),
          fridayDate,
          wetWeightKg: wet,
        }),
      );
      onClose();
      return;
    }

    if (!completedAt) {
      setError('Date/time of activity is required.');
      return;
    }
    setError(null);
    const sectionProps = props as SectionModeProps & {
      isOpen: boolean;
      onClose: () => void;
    };
    sectionProps.onConfirm(
      generateAutofillDefaults(sectionProps.section, {
        completedAt,
        operatorName: operatorName.trim(),
        extraDates,
        taskCode: sectionProps.taskCode,
      }),
    );
    onClose();
  };

  const sectionExtraFields = mode === 'section' ? AUTOFILL_EXTRA_DATE_FIELDS[props.section] : [];

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
            <h3 className="text-xl font-semibold text-gray-900">
              {mode === 'batch' ? 'Autofill whole batch' : 'Autofill form'}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {mode === 'batch' ? (
                <>
                  Prefill <span className="font-semibold text-gray-900">{title}</span> using the
                  Fri→Sat→Sun schedule. Times are backdated; wet weight comes from the recipe fill.
                </>
              ) : (
                <>
                  Prefill <span className="font-semibold text-gray-900">{title}</span> with
                  pass-range values. You can edit any field before submitting.
                </>
              )}
            </p>
          </div>

          <form onSubmit={handleConfirm} className="mt-5 space-y-4">
            {mode === 'section' && (
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
            )}

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

            {mode === 'batch' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Production Friday <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={fridayDate}
                    onChange={(e) => setFridayDate(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Marinate Fri 6–7pm → dryer Sat 6–8pm (&gt;20 h) → unload Sun 8am–1pm.
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Wet weight (kg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={wetWeightKg}
                    onChange={(e) => setWetWeightKg(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60"
                    placeholder="e.g. 18.5"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Prefills from beef + recipe ingredient fills. Dry weight / loss is calculated on
                    unload (≥54% loss).
                  </p>
                </div>

                {schedulePreview && (
                  <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-sm text-gray-700">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Derived schedule (sample)
                    </p>
                    <p>
                      <span className="text-gray-500">Marinate:</span>{' '}
                      {formatPreviewLocal(schedulePreview.marinate_start)} →{' '}
                      {formatPreviewLocal(schedulePreview.marinate_end)} (
                      {schedulePreview.marinade_hours} h)
                    </p>
                    <p>
                      <span className="text-gray-500">Dry:</span>{' '}
                      {formatPreviewLocal(schedulePreview.drying_start)} →{' '}
                      {formatPreviewLocal(schedulePreview.drying_end)} (
                      {schedulePreview.drying_hours} h)
                    </p>
                    {dryPreview != null && (
                      <p>
                        <span className="text-gray-500">Est. dry @ ~{lossPreview}% loss:</span>{' '}
                        {dryPreview} kg
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Confirming generates a fresh random-in-window schedule and backdates each
                      checkpoint.
                    </p>
                  </div>
                )}
              </>
            )}

            {mode === 'section' && sectionExtraFields.length > 0 && (
              <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Section dates
                </p>
                {sectionExtraFields.map((field) => (
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
                {mode === 'batch' ? 'Autofill batch' : 'Autofill'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
