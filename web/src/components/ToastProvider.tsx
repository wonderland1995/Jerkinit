'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface ToastInput {
  title: string;
  description?: string;
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
  variant: ToastVariant;
}

interface ToastContextValue {
  push: (variant: ToastVariant, input: ToastInput) => number;
  success: (title: string, input?: Omit<ToastInput, 'title'>) => number;
  error: (title: string, input?: Omit<ToastInput, 'title'>) => number;
  info: (title: string, input?: Omit<ToastInput, 'title'>) => number;
  warning: (title: string, input?: Omit<ToastInput, 'title'>) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 4000;

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: 'border-slate-200 bg-white text-slate-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
};

const DEFAULT_TITLE: Record<ToastVariant, string> = {
  default: 'Notice',
  success: 'Success',
  error: 'Something went wrong',
  warning: 'Heads up',
  info: 'FYI',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, input: ToastInput) => {
      const id = Date.now() + Math.random();
      const duration = Number.isFinite(input.duration ?? DEFAULT_DURATION)
        ? Math.max(0, input.duration ?? DEFAULT_DURATION)
        : DEFAULT_DURATION;

      setToasts((prev) => [
        ...prev,
        {
          id,
          variant,
          title: input.title || DEFAULT_TITLE[variant],
          description: input.description,
          duration,
        },
      ]);

      if (duration > 0) {
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  const api = useMemo<ToastContextValue>(
    () => ({
      push,
      dismiss,
      success: (title, options) =>
        push('success', { title, ...options }),
      error: (title, options) =>
        push('error', { title, ...options }),
      info: (title, options) =>
        push('info', { title, ...options }),
      warning: (title, options) =>
        push('warning', { title, ...options }),
    }),
    [dismiss, push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex flex-col gap-1 rounded-lg border px-4 py-3 shadow-lg transition ${
              VARIANT_STYLES[toast.variant]
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium">{toast.title || DEFAULT_TITLE[toast.variant]}</div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="text-sm text-slate-500 hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
            {toast.description ? (
              <div className="text-sm text-slate-700">{toast.description}</div>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
