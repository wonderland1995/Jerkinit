import Link from 'next/link';
import type { ElementType } from 'react';
import type { Metadata } from 'next';
import { Droplet, Ruler, ThermometerSun, Timer } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

const awReading = 0.793;

const processHighlights: Array<{
  icon: ElementType;
  label: string;
  value: string;
  detail?: string;
}> = [
  {
    icon: Ruler,
    label: 'Trim spec',
    value: '5 mm slices',
    detail: 'Lean beef is trimmed, all silver skin removed, then sliced to a consistent 5 mm thickness.',
  },
  {
    icon: Timer,
    label: 'Marination window',
    value: '24–48 hours',
    detail: 'Strips remain fully submerged in the marinade for at least one day (never more than two) before loading.',
  },
  {
    icon: ThermometerSun,
    label: 'Initial oven temperature',
    value: '65 °C',
    detail: 'Cabinet is pre-heated and stabilized at 65 °C before the racks enter.',
  },
];

const thermalProgram = [
  {
    stage: 'Charge & dehydrate',
    profile: '75 °C for 30 minutes',
    detail:
      'Racks go straight into a 75 °C dry cabinet for the first 30 minutes to start the dehydration.',
  },
  {
    stage: 'Controlled dry',
    profile: '65 °C for ≥12 hours',
    detail:
      'Cabinet is reduced to 65 °C and held for a minimum of twelve hours to drive moisture down slowly.',
  },
  {
    stage: 'Final kill step',
    profile: '75 °C for 30 minutes',
    detail:
      'The batch finishes with another 30-minute hold at 75 °C before being tempered for sampling.',
  },
];

const measurementSteps = [
  'After the final 75 °C hold, a composite from every flavour produced that day is sealed and labelled as one production “batch”.',
  'Each production day counts as a batch for verification; after ten days the retained samples are chilled and couriered to the accredited lab.',
  'The lab issues the official water activity report (latest series confirmed 0.793 aw).',
];

export const metadata: Metadata = {
  title: 'Water Activity Proof | QA',
  description:
    'Documented time and temperature method that produces the validated water activity measurement for Jerkin It jerky.',
};

export default function WaterActivityProofPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white pb-16">
      <div className="mx-auto max-w-5xl px-6 pt-10">
        <Breadcrumbs
          items={[
            { label: 'QA', href: '/qa' },
            { label: 'Water activity proof', href: '/qa/water-activity-proof' },
          ]}
        />

        <div className="rounded-3xl border border-blue-100 bg-white p-8 shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                Drying validation
              </p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">
                Proof of method for water activity
              </h1>
              <p className="mt-3 max-w-3xl text-base text-gray-600">
                The process below is the exact production method the team follows. It captures
                slicing thickness, marination window, the cabinet profile, and the final kill step
                that together produced the documented 0.793 aw reading.
              </p>
            </div>
            <Link
              href="/qa"
              className="inline-flex items-center justify-center rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Back to QA hub
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {processHighlights.map((item) => (
              <div key={item.label} className="rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-gray-500">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{item.value}</p>
                {item.detail && <p className="mt-2 text-sm text-gray-600">{item.detail}</p>}
              </div>
            ))}
          </div>
        </div>

        <section className="mt-10 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Thermal path</p>
          <h2 className="mt-2 text-2xl font-semibold text-gray-900">
            Cabinet temperatures, timings, and holds
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            After the marinated strips enter the cabinet, the operator follows the exact sequence
            below. No additional steps are taken beyond this documented program.
          </p>

          <div className="mt-6 space-y-4">
            {thermalProgram.map((stage) => (
              <div
                key={stage.stage}
                className="rounded-2xl border border-gray-100 bg-slate-50/60 p-5 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  {stage.stage}
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{stage.profile}</p>
                <p className="mt-2 text-sm text-gray-700">{stage.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600/10 p-3">
              <Droplet className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Water activity measurement
              </p>
              <h2 className="text-2xl font-semibold text-gray-900">
                Measured result: {awReading.toFixed(3)} aw
              </h2>
              <p className="text-sm text-gray-600">
                Verification is performed by an external laboratory after every ten production days (each day is logged as a batch even when multiple flavours run).
              </p>
            </div>
          </div>

          <ul className="mt-6 space-y-3 text-sm text-gray-700">
            {measurementSteps.map((step) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" aria-hidden />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
