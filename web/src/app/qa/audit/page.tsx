'use client';

import Link from 'next/link';
import { useMemo } from 'react';

type Card = {
  title: string;
  value: string;
  detail?: string;
  tone?: 'ok' | 'warn' | 'alert';
};

const toneClass: Record<Card['tone'] & string, string> = {
  ok: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warn: 'bg-amber-50 border-amber-200 text-amber-800',
  alert: 'bg-red-50 border-red-200 text-red-800',
  undefined: 'bg-slate-50 border-slate-200 text-slate-800',
};

export default function AuditSnapshotPage() {
  // NOTE: In production, wire these to real data sources:
  // - Last aw lab result: QA document or lab integration
  // - Probe calibration: calibration/maintenance table
  // - Mock recall: recall events
  // - Open CAPAs: CAPA/NC table
  const cards: Card[] = useMemo(
    () => [
      {
        title: 'Last aw lab result',
        value: '0.793 (PASS)',
        detail: 'Batch JI-C21V5-003 on 21 Nov 2025',
        tone: 'ok',
      },
      {
        title: 'Probe calibration',
        value: 'All in date',
        detail: 'Next due: 05 Dec 2025',
        tone: 'ok',
      },
      {
        title: 'Last mock recall',
        value: '10 Nov 2025',
        detail: 'Outcome: Completed within 30 minutes',
        tone: 'ok',
      },
      {
        title: 'Open CAPAs',
        value: '0',
        detail: 'No open corrective actions',
        tone: 'ok',
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Audit mode</p>
            <h1 className="text-3xl font-bold text-slate-900">Audit snapshot</h1>
            <p className="text-sm text-slate-600">
              A 30-second view of our controls: drying validation, water activity proof, and traceable records.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/qa/water-activity-proof"
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-700"
            >
              Jerky Validation
            </Link>
            <Link
              href="/qa"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              QA Hub
            </Link>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => (
            <div
              key={card.title}
              className={`rounded-xl border p-4 shadow-sm ${toneClass[card.tone ?? '']}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide">{card.title}</p>
              <p className="mt-2 text-xl font-bold">{card.value}</p>
              {card.detail && <p className="mt-1 text-sm opacity-80">{card.detail}</p>}
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Quick links</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>
                <Link href="/qa/water-activity-proof" className="text-sky-700 hover:underline">
                  Validated drying method (time/temp/weight-loss → aw &lt; 0.85)
                </Link>
              </li>
              <li>
                <Link href="/qa" className="text-sky-700 hover:underline">
                  QA hub and current batch checkpoints
                </Link>
              </li>
              <li>
                <Link href="/batches" className="text-sky-700 hover:underline">
                  Latest batches (export PDFs from batch detail)
                </Link>
              </li>
            </ul>
            <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              Tip: From each batch detail page, use “Export to PDF” for the full QA record. Keep the three most recent
              PDFs handy for auditors.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Evidence checklist</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>Drying validation narrative (JerkyValidationPage)</li>
              <li>Latest aw lab report (keep a current PDF in QA documents)</li>
              <li>Most recent 3 batch QA PDFs (time/temp/weight loss, attachments)</li>
              <li>Probe calibration log (due dates visible)</li>
              <li>Mock recall record and outcome</li>
              <li>CAPA register (open/closed items)</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
