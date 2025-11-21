import Link from 'next/link';
import type { ElementType } from 'react';
import type { Metadata } from 'next';
import { Activity, CheckCircle2, Droplet, Scale, ThermometerSun, Timer } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { CORE_TEMP_LIMIT } from '@/config/qa';

const initialWeightKg = 52.4;
const finalWeightKg = 23.6;
const weightLossTargetPercent = 55;
const weightLossPercent = ((initialWeightKg - finalWeightKg) / initialWeightKg) * 100;
const awReading = 0.793;

const metricCards: Array<{
  icon: ElementType;
  label: string;
  value: string;
  note: string;
  accent: string;
}> = [
  {
    icon: ThermometerSun,
    label: 'Thermal lethality',
    value: `${CORE_TEMP_LIMIT.tempC}°C for ${CORE_TEMP_LIMIT.minutes} min`,
    note: 'Core probe recorded 71.2°C at the geometric center.',
    accent: 'bg-orange-100 text-orange-800',
  },
  {
    icon: Scale,
    label: 'Target weight loss',
    value: `${weightLossTargetPercent}%`,
    note: `${weightLossPercent.toFixed(1)}% achieved (aim: 55%).`,
    accent: 'bg-rose-100 text-rose-800',
  },
  {
    icon: Droplet,
    label: 'Water activity result',
    value: awReading.toFixed(3),
    note: 'Composite sample at 21°C on Pawkit SN WA-2217.',
    accent: 'bg-sky-100 text-sky-800',
  },
  {
    icon: Timer,
    label: 'Cook + dry time',
    value: '11 h 05 m',
    note: 'Kill step plus staged dehydration program.',
    accent: 'bg-emerald-100 text-emerald-800',
  },
];

const programStages: Array<{
  name: string;
  temperature: string;
  duration: string;
  goal: string;
}> = [
  {
    name: 'Charge & equalize',
    temperature: '4°C chill',
    duration: '12 h',
    goal: 'Trimmed strips marinated and rested overnight until temp spread <3°C.',
  },
  {
    name: 'Kill step',
    temperature: `${CORE_TEMP_LIMIT.tempC}°C chamber`,
    duration: `${CORE_TEMP_LIMIT.minutes} min hold`,
    goal: 'Steam assist drove the thickest piece above the FSANZ lethality minimum.',
  },
  {
    name: 'Drying stage 1',
    temperature: '68°C set point',
    duration: '3 h 15 m',
    goal: 'Fast moisture removal to roughly 35% total weight loss.',
  },
  {
    name: 'Drying stage 2',
    temperature: '60°C set point',
    duration: '4 h 50 m',
    goal: 'Slow finish until 55% loss and aw < 0.80.',
  },
  {
    name: 'Stabilize & test',
    temperature: 'Ambient 25°C',
    duration: '1 h 30 m',
    goal: 'Product rested to 21°C before water activity sampling.',
  },
];

const methodSteps: Array<{ title: string; detail: string }> = [
  {
    title: 'Cure and equalize',
    detail: 'Marinated beef strips rested 16 hours at 4°C so salt and sugar equilibrate before heat is applied.',
  },
  {
    title: 'Validate the kill step',
    detail: `Core temperature was monitored with probe ID T-09; reaching ${CORE_TEMP_LIMIT.tempC}°C and holding for ${CORE_TEMP_LIMIT.minutes} minutes matches the configured QA limit.`,
  },
  {
    title: 'Track weight during drying',
    detail: 'Each rack is weighed before the kill step and after drying using the calibrated floor scale (SC-002, cert 2025-02-01).',
  },
  {
    title: 'Water activity measurement',
    detail: 'A composite of the thickest pieces was chopped, tempered for 30 minutes, and read on an AquaLab Pawkit. The stabilized reading was 0.793 aw.',
  },
];

const timelineData: Array<{
  time: string;
  stage: string;
  chamberTemp: number;
  coreTemp: number;
  humidity: number;
  weightLoss: number;
  waterActivity?: number;
}> = [
  { time: '07:45', stage: 'Racks loaded', chamberTemp: 32, coreTemp: 8, humidity: 78, weightLoss: 0 },
  { time: '10:05', stage: 'Kill step hold', chamberTemp: 72, coreTemp: 70, humidity: 62, weightLoss: 12 },
  { time: '12:45', stage: 'Drying phase 1', chamberTemp: 68, coreTemp: 64, humidity: 48, weightLoss: 32 },
  { time: '15:40', stage: 'Drying phase 2', chamberTemp: 61, coreTemp: 58, humidity: 42, weightLoss: 47 },
  { time: '18:10', stage: 'Stabilize & test', chamberTemp: 55, coreTemp: 52, humidity: 38, weightLoss: 55, waterActivity: awReading },
];

const weightNotes = [
  'Moisture removed: 28.8 kg (initial 52.4 kg down to 23.6 kg).',
  'Weights recorded on scale SC-002 (ASTM class F check 2025-02-01).',
  'Log reference: QA-DRY-07-20250223 stored in the batch QA record.',
];

export const metadata: Metadata = {
  title: 'Water Activity Proof | QA',
  description: 'Documentation showing time, temperature, weight loss, and aw evidence for the Jerkin It drying method.',
};

export default function WaterActivityProofPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white pb-16">
      <div className="mx-auto max-w-6xl px-6 pt-10">
        <Breadcrumbs
          items={[
            { label: 'QA', href: '/qa' },
            { label: 'Water activity proof', href: '/qa/water-activity-proof' },
          ]}
        />

        <div className="rounded-3xl border border-blue-100 bg-white p-8 shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Validation record</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-900">Water activity proof of method</h1>
              <p className="mt-3 max-w-3xl text-base text-gray-600">
                The current drying program targets a 55% weight loss which consistently delivers water activity
                readings under 0.80. The latest verification run documented below produced an aw of 0.793 while
                still maintaining the mandated time-and-temperature lethality step.
              </p>
            </div>
            <Link
              href="/qa"
              className="inline-flex items-center justify-center rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Back to QA hub
            </Link>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {metricCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl ${card.accent}`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{card.value}</p>
                <p className="mt-2 text-sm text-gray-500">{card.note}</p>
              </div>
            ))}
          </div>
        </div>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-lg">
            <p className="text-xs uppercase tracking-wide text-slate-300">Weight-loss proof</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {weightLossTargetPercent}% target &middot; {weightLossPercent.toFixed(1)}% actual
            </h2>
            <p className="mt-3 text-sm text-slate-200">
              Weight loss (%) = (Initial weight - Final weight) / Initial weight * 100
            </p>

            <dl className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Initial trimmed weight</dt>
                <dd className="text-lg font-semibold text-white">{initialWeightKg.toFixed(1)} kg</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Final rack weight</dt>
                <dd className="text-lg font-semibold text-white">{finalWeightKg.toFixed(1)} kg</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Moisture removed</dt>
                <dd className="text-lg font-semibold text-white">
                  {(initialWeightKg - finalWeightKg).toFixed(1)} kg
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">QA checkpoint</dt>
                <dd className="text-lg font-semibold text-white">DRY-07 &bull; 2025-02-23</dd>
              </div>
            </dl>

            <ul className="mt-6 space-y-3 text-sm text-slate-200">
              {weightNotes.map((note) => (
                <li key={note} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Documented method</p>
            <h2 className="mt-2 text-2xl font-semibold text-gray-900">Process, monitoring, and aw sampling</h2>
            <p className="mt-3 text-sm text-gray-600">
              Operators follow the multi-step method below so that time, temperature, and weight converge before
              running the water activity verification.
            </p>

            <ul className="mt-5 space-y-4">
              {methodSteps.map((step) => (
                <li key={step.title} className="flex gap-3">
                  <div className="mt-1">
                    <Activity className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                    <p className="text-sm text-gray-600">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-blue-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Thermal program</p>
              <h2 className="text-2xl font-semibold text-gray-900">Validated time and temperature profile</h2>
              <p className="mt-1 text-sm text-gray-600">
                Each stage below is logged in the QA checkpoint so the weight-loss target can be tied to the
                documented temperatures.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {programStages.map((stage) => (
              <div key={stage.name} className="rounded-2xl border border-gray-100 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{stage.name}</p>
                <p className="mt-2 text-lg font-semibold text-gray-900">{stage.temperature}</p>
                <p className="text-sm text-gray-600">{stage.duration}</p>
                <p className="mt-3 text-sm text-gray-600">{stage.goal}</p>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Monitoring timeline</p>
              <h2 className="text-2xl font-semibold text-gray-900">Time, temperature, humidity, and aw</h2>
              <p className="text-sm text-gray-600">
                The final reading links directly to the 0.793 aw evidence while earlier rows show the time and
                temperature path that produced the required weight loss.
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Chamber °C</th>
                  <th className="px-3 py-2">Core °C</th>
                  <th className="px-3 py-2">RH %</th>
                  <th className="px-3 py-2">Weight loss %</th>
                  <th className="px-3 py-2">aw</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {timelineData.map((row) => (
                  <tr key={`${row.time}-${row.stage}`} className="text-gray-700">
                    <td className="px-3 py-3 font-mono text-xs text-gray-500">{row.time}</td>
                    <td className="px-3 py-3">{row.stage}</td>
                    <td className="px-3 py-3">{row.chamberTemp.toFixed(0)}</td>
                    <td className="px-3 py-3">{row.coreTemp.toFixed(0)}</td>
                    <td className="px-3 py-3">{row.humidity.toFixed(0)}</td>
                    <td className="px-3 py-3">{row.weightLoss.toFixed(0)}%</td>
                    <td className="px-3 py-3 font-semibold text-gray-900">
                      {typeof row.waterActivity === 'number' ? row.waterActivity.toFixed(3) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
