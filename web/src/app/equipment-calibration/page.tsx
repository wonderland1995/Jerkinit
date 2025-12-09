'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Cpu, Printer, Radar, Rocket, Sparkles, TestTube2, Thermometer, Wand2 } from 'lucide-react';
import { Orbitron, Space_Grotesk } from 'next/font/google';
import type { EquipmentWithCalibration } from '@/types/equipment';
import { formatDate } from '@/lib/utils';

const space = Space_Grotesk({ subsets: ['latin'], variable: '--font-space' });
const orbitron = Orbitron({ subsets: ['latin'], weight: ['600', '700'], variable: '--font-orbitron' });

type CalibrationDraft = {
  performed_by: string;
  observed_ice_c: string;
  observed_boiling_c: string;
  notes: string;
  result: string;
  method: string;
  next_due_at: string;
};

const DEFAULT_METHOD = 'FSANZ ice slurry + boiling water two-point';

export default function EquipmentCalibrationPage() {
  const [equipment, setEquipment] = useState<EquipmentWithCalibration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [calibrating, setCalibrating] = useState<Record<string, boolean>>({});
  const [calibrationDrafts, setCalibrationDrafts] = useState<Record<string, CalibrationDraft>>({});
  const [form, setForm] = useState({
    name: '',
    type: 'thermometer',
    model: '',
    serial_number: '',
    location: '',
    calibration_interval_days: 30,
    label_code: '',
  });

  useEffect(() => {
    void loadEquipment();
  }, []);

  const stats = useMemo(() => {
    const total = equipment.length;
    let overdue = 0;
    let dueSoon = 0;
    let clean = 0;

    equipment.forEach((item) => {
      const status = deriveCalibrationStatus(item);
      if (status.state === 'overdue') overdue += 1;
      else if (status.state === 'due_soon') dueSoon += 1;
      else if (status.state === 'ok') clean += 1;
    });

    return { total, overdue, dueSoon, clean };
  }, [equipment]);

  async function loadEquipment() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/equipment', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? 'Unable to load equipment');
      }
      setEquipment(Array.isArray(body.equipment) ? body.equipment : []);
    } catch (err) {
      console.error(err);
      setError('Failed to load equipment. Please refresh.');
      setEquipment([]);
    } finally {
      setLoading(false);
    }
  }

  const handleAddEquipment = async (ev: React.FormEvent) => {
    ev.preventDefault();
    try {
      setAdding(true);
      setError(null);
      const payload = {
        ...form,
        calibration_interval_days: Number(form.calibration_interval_days) || 30,
        label_code: form.label_code.trim() || undefined,
      };
      const res = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? 'Unable to add equipment');
      }
      if (body.equipment) {
        setEquipment((prev) => [body.equipment as EquipmentWithCalibration, ...prev]);
        setForm({
          name: '',
          type: 'thermometer',
          model: '',
          serial_number: '',
          location: '',
          calibration_interval_days: 30,
          label_code: '',
        });
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Unable to add equipment');
    } finally {
      setAdding(false);
    }
  };

  const handleCalibrate = async (equipmentId: string) => {
    const draft = calibrationDrafts[equipmentId];
    try {
      setCalibrating((s) => ({ ...s, [equipmentId]: true }));
      const observedIce = draft?.observed_ice_c ? Number(draft.observed_ice_c) : null;
      const observedBoiling = draft?.observed_boiling_c ? Number(draft.observed_boiling_c) : null;
      const drift =
        observedIce == null && observedBoiling == null
          ? null
          : Math.max(
              Math.abs((observedIce ?? 0) - 0),
              Math.abs((observedBoiling ?? 100) - 100)
            );
      const defaultResult =
        drift == null ? 'Recorded' : drift <= 0.5 ? 'Pass (+/-0.5 C)' : `Adjust/flag (${drift.toFixed(1)} C drift)`;

      const payload = {
        performed_by: draft?.performed_by || 'FSANZ verification',
        method: draft?.method || DEFAULT_METHOD,
        observed_ice_c: observedIce,
        observed_boiling_c: observedBoiling,
        result: draft?.result || defaultResult,
        notes: draft?.notes || '',
        next_due_at: draft?.next_due_at || null,
      };

      const res = await fetch(`/api/equipment/${equipmentId}/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error ?? 'Failed to save calibration');
      }
      if (body.equipment) {
        setEquipment((prev) =>
          prev.map((item) => (item.id === equipmentId ? (body.equipment as EquipmentWithCalibration) : item))
        );
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to calibrate equipment');
    } finally {
      setCalibrating((s) => ({ ...s, [equipmentId]: false }));
    }
  };

  const handlePrintLabel = (item: EquipmentWithCalibration) => {
    if (typeof window === 'undefined') return;
    const win = window.open('', '_blank', 'width=480,height=640');
    if (!win) {
      alert('Please allow pop-ups to print labels');
      return;
    }
    const safe = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const nextDue = formatDate(item.latest_calibration_due_at);
    const last = formatDate(item.latest_calibrated_at, true);
    const body = `
      <html>
        <head>
          <title>Calibration label</title>
          <style>
            :root {
              color-scheme: light;
              font-family: 'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
            }
            body { margin: 0; padding: 16px; background: #0b1224; color: #e8f3ff; }
            .card {
              border-radius: 14px;
              background: radial-gradient(circle at 20% 20%, rgba(52,211,153,0.2), transparent 40%),
                          radial-gradient(circle at 80% 0%, rgba(59,130,246,0.25), transparent 45%),
                          #0f172a;
              padding: 18px;
              border: 1px solid rgba(148, 163, 184, 0.4);
              box-shadow: 0 14px 40px rgba(0,0,0,0.35);
            }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .pill { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #34d399; font-weight: 700; font-size: 12px; letter-spacing: 0.06em; }
            h1 { margin: 0 0 8px 0; font-size: 18px; letter-spacing: 0.08em; text-transform: uppercase; }
            .label { font-size: 12px; color: #9fb2d0; text-transform: uppercase; letter-spacing: 0.08em; }
            .value { font-size: 14px; font-weight: 700; color: #e2e8f0; }
            .code { font-family: 'JetBrains Mono', monospace; font-size: 13px; letter-spacing: 0.12em; color: #a5f3fc; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <h1>${safe(item.name)}</h1>
              <span class="pill">${safe(item.type)}</span>
            </div>
            <div class="code">${safe(item.label_code ?? '')}</div>
            <div class="grid" style="margin-top:12px;">
              <div>
                <div class="label">Last calibration</div>
                <div class="value">${safe(last)}</div>
              </div>
              <div>
                <div class="label">Next due</div>
                <div class="value">${safe(nextDue)}</div>
              </div>
              <div>
                <div class="label">Location</div>
                <div class="value">${safe(item.location ?? 'Floor')}</div>
              </div>
              <div>
                <div class="label">Method</div>
                <div class="value">${safe(item.latest_calibration_result ?? DEFAULT_METHOD)}</div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    win.document.write(body);
    win.document.close();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-emerald-700">
        <div className="flex items-center gap-3 rounded-full border border-emerald-200 bg-white px-5 py-3 shadow-lg shadow-emerald-100">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-emerald-500" />
          <span className="text-sm font-semibold tracking-wide">Loading calibration workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`${space.className} ${space.variable} ${orbitron.variable} relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-sky-50 text-slate-900`}>
      <FuturisticBackdrop />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-emerald-700">
              <Sparkles className="h-4 w-4" />
              Calibration Lab
            </p>
            <h1 className={`${orbitron.className} text-3xl font-semibold tracking-tight sm:text-4xl`}>
              Equipment calibration (FSANZ aligned)
            </h1>
            <p className="max-w-3xl text-sm text-slate-600">
              Register instruments, record the ice and boiling point checks, and print clear labels for quick compliance verification.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <StatPill label="Total" value={stats.total} accent="from-emerald-500 to-teal-500" />
            <StatPill label="In tolerance" value={stats.clean} accent="from-sky-500 to-cyan-500" />
            <StatPill label="Due soon" value={stats.dueSoon} accent="from-amber-500 to-orange-500" />
            <StatPill label="Overdue" value={stats.overdue} accent="from-rose-500 to-pink-500" />
          </div>
        </header>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {equipment.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-slate-700 shadow-md shadow-slate-200">
                <div className="flex items-start gap-3">
                  <Thermometer className="h-6 w-6 text-emerald-600" />
                  <div>
                    <p className="text-lg font-semibold text-slate-900">No equipment yet</p>
                    <p className="text-sm text-slate-600">Add your first thermometer or scale to generate a calibration label.</p>
                  </div>
                </div>
              </div>
            ) : (
              equipment.map((item) => (
                <EquipmentCard
                  key={item.id}
                  item={item}
                  onCalibrate={() => handleCalibrate(item.id)}
                  calibrating={!!calibrating[item.id]}
                  draft={calibrationDrafts[item.id]}
                  setDraft={(next) =>
                    setCalibrationDrafts((d) => ({
                      ...d,
                      [item.id]: { ...defaultDraft(item, d[item.id]), ...next },
                    }))
                  }
                  onPrint={() => handlePrintLabel(item)}
                />
              ))
            )}
          </div>

          <aside className="space-y-6">
            <AddEquipmentCard
              form={form}
              onChange={setForm}
              onSubmit={handleAddEquipment}
              adding={adding}
            />
            <FsanzSteps />
          </aside>
        </div>
      </div>
    </div>
  );
}

function deriveCalibrationStatus(item: EquipmentWithCalibration) {
  if (item.status && item.status !== 'active') {
    return { state: 'inactive' as const, label: 'Out of service', tone: 'rose' as const };
  }
  const due = item.latest_calibration_due_at ? new Date(item.latest_calibration_due_at) : null;
  if (!due || Number.isNaN(due.getTime())) {
    return { state: 'unknown' as const, label: 'Not calibrated', tone: 'amber' as const };
  }
  const diffDays = Math.floor((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { state: 'overdue' as const, label: 'Overdue', tone: 'rose' as const };
  if (diffDays <= 7) return { state: 'due_soon' as const, label: 'Due soon', tone: 'amber' as const };
  return { state: 'ok' as const, label: 'In tolerance', tone: 'emerald' as const };
}

function defaultDraft(
  item: EquipmentWithCalibration,
  existing?: CalibrationDraft
): CalibrationDraft {
  return {
    performed_by: existing?.performed_by ?? '',
    observed_ice_c: existing?.observed_ice_c ?? '',
    observed_boiling_c: existing?.observed_boiling_c ?? '',
    notes: existing?.notes ?? '',
    result: existing?.result ?? '',
    method: existing?.method ?? DEFAULT_METHOD,
    next_due_at: existing?.next_due_at ?? (item.latest_calibration_due_at ?? '').slice(0, 10),
  };
}

function EquipmentCard({
  item,
  draft,
  setDraft,
  onCalibrate,
  onPrint,
  calibrating,
}: {
  item: EquipmentWithCalibration;
  draft?: CalibrationDraft;
  setDraft: (draft: CalibrationDraft) => void;
  onCalibrate: () => void;
  onPrint: () => void;
  calibrating: boolean;
}) {
  const status = deriveCalibrationStatus(item);
  const dueDate = formatDate(item.latest_calibration_due_at);
  const last = item.latest_calibrated_at ? formatDate(item.latest_calibrated_at, true) : '--';
  const draftState = defaultDraft(item, draft);

  const toneClass =
    status.tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status.tone === 'amber'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : status.tone === 'rose'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-100/40 via-transparent to-sky-100/30" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">Instrument</p>
          <h2 className="text-xl font-semibold text-slate-900">{item.name}</h2>
          <p className="text-sm text-slate-600">
            {item.type} | {item.model || 'Model N/A'} | {item.location || 'Location N/A'}
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur ${
            toneClass
          }`}
        >
          {status.label}
        </span>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3 text-sm text-slate-800 sm:grid-cols-4">
        <InfoTile label="Label code" value={item.label_code} icon={<Cpu className="h-4 w-4" />} />
        <InfoTile label="Last calibration" value={last} icon={<Radar className="h-4 w-4" />} />
        <InfoTile label="Next due" value={dueDate} icon={<ClockBadge />} />
        <InfoTile
          label="Result"
          value={item.latest_calibration_result ?? 'Waiting'}
          icon={<ClipboardCheck className="h-4 w-4" />}
        />
      </div>

      <div className="relative mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-700">
            <Thermometer className="h-4 w-4 text-emerald-600" />
            Enter FSANZ check
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
            <div>
              <label className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Ice slurry (C)</label>
              <input
                type="number"
                step="0.1"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                value={draftState.observed_ice_c}
                onChange={(e) =>
                  setDraft({ ...draftState, observed_ice_c: e.target.value })
                }
                placeholder="0.2"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Boiling (C)</label>
              <input
                type="number"
                step="0.1"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                value={draftState.observed_boiling_c}
                onChange={(e) =>
                  setDraft({ ...draftState, observed_boiling_c: e.target.value })
                }
                placeholder="99.8"
              />
            </div>
          </div>
          <label className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Technician</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
            value={draftState.performed_by}
            onChange={(e) => setDraft({ ...draftState, performed_by: e.target.value })}
            placeholder="Drift / FSANZ check by..."
          />
          <label className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Notes</label>
          <textarea
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
            rows={2}
            value={draftState.notes}
            onChange={(e) => setDraft({ ...draftState, notes: e.target.value })}
            placeholder="Ice slurry held at 0.1 C; probe sanitised pre/post."
          />
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Result</label>
              <input
                type="text"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                value={draftState.result}
                onChange={(e) => setDraft({ ...draftState, result: e.target.value })}
                placeholder="Pass (+/-0.5 C)"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Next due</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                value={draftState.next_due_at}
                onChange={(e) => setDraft({ ...draftState, next_due_at: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-700">
            <TestTube2 className="h-4 w-4 text-cyan-600" />
            Label + print
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-slate-700">
            <Badge>Interval: {item.calibration_interval_days} days</Badge>
            <Badge>Drift target +/-0.5 C</Badge>
            <Badge>{item.serial_number || 'No serial'}</Badge>
          </div>
          <div className="flex flex-col gap-2 text-sm text-slate-700">
            <p className="text-slate-700">
              Latest: {item.latest_calibration_result ?? 'Awaiting check'}
            </p>
            <p className="text-slate-600">
              Ice @0C / boil @100C, adjust offset if drift &gt;0.5C. Sanitize probe between points.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCalibrate}
              disabled={calibrating}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition hover:shadow-emerald-300 disabled:opacity-60"
            >
              {calibrating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  Saving...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  Calibrate now
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-inner shadow-slate-100 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <Printer className="h-4 w-4" />
              Print label
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-inner shadow-slate-100">
      <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value || '--'}</p>
    </div>
  );
}

type EquipmentForm = {
  name: string;
  type: string;
  model: string;
  serial_number: string;
  location: string;
  calibration_interval_days: number;
  label_code: string;
};

function AddEquipmentCard({
  form,
  onChange,
  onSubmit,
  adding,
}: {
  form: EquipmentForm;
  onChange: (form: EquipmentForm) => void;
  onSubmit: (ev: React.FormEvent) => void;
  adding: boolean;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-100/40 via-transparent to-cyan-100/40" />
      <div className="relative space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">Add instrument</p>
            <h3 className="text-xl font-semibold text-slate-900">Expand beyond thermometers</h3>
          </div>
          <Rocket className="h-6 w-6 text-emerald-600" />
        </div>

        <label className="block text-xs uppercase tracking-[0.2em] text-slate-500">
          Equipment name
          <input
            required
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
            placeholder="Core Thermometer 01"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
          />
        </label>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Type
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
              placeholder="thermometer / scale / probe"
              value={form.type}
              onChange={(e) => onChange({ ...form, type: e.target.value })}
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Model
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
              placeholder="Testo / Tanita / etc"
              value={form.model}
              onChange={(e) => onChange({ ...form, model: e.target.value })}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Serial / asset tag
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
              placeholder="THERM-001"
              value={form.serial_number}
              onChange={(e) => onChange({ ...form, serial_number: e.target.value })}
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Location
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
              placeholder="Packaging bench / chill room"
              value={form.location}
              onChange={(e) => onChange({ ...form, location: e.target.value })}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Interval (days)
            <input
              type="number"
              min="1"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
              value={form.calibration_interval_days}
              onChange={(e) => onChange({ ...form, calibration_interval_days: Number(e.target.value) })}
            />
          </label>
          <label className="text-xs uppercase tracking-[0.2em] text-slate-500">
            Label code (optional)
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
              placeholder="EQ-THERM-01"
              value={form.label_code}
              onChange={(e) => onChange({ ...form, label_code: e.target.value })}
            />
          </label>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition hover:shadow-emerald-300 disabled:opacity-60"
          disabled={adding}
        >
          {adding ? 'Seeding to console...' : 'Add equipment + generate label'}
        </button>
      </div>
    </form>
  );
}

function FsanzSteps() {
  const steps = [
    {
      title: 'Sanitize and stabilize',
      detail: 'Clean probe tip, let the thermometer acclimate for 5 minutes in the processing room.',
    },
    {
      title: 'Ice slurry @ 0C',
      detail:
        'Crushed ice + small amount of potable water, stir to a slush. Insert probe 5 cm deep, avoid touching sides. Wait for a stable reading (FSANZ thermometer check).',
    },
    {
      title: 'Boiling point @ 100C',
      detail:
        'Rolling boil distilled/filtered water. Suspend probe in steam pocket above bubbles. Allow stabilisation; adjust for altitude if needed.',
    },
    {
      title: 'Compare vs tolerance',
      detail:
        'Target drift <= +/-0.5 C. If outside tolerance, adjust offset/replace unit, label as out-of-service, and retest.',
    },
    {
      title: 'Document + label',
      detail:
        'Record ice/boil readings, technician, corrective actions, next due date, and print a fresh label for the device.',
    },
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-700">FSANZ flow</p>
          <h3 className="text-lg font-semibold text-slate-900">Thermometer calibration steps</h3>
        </div>
        <div className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-700">
          +/-0.5 C
        </div>
      </div>
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div
            key={step.title}
            className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-200 hover:shadow-lg hover:shadow-cyan-100"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-cyan-100 to-emerald-100 text-cyan-700">
                <span className="font-semibold">{idx + 1}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                <p className="text-xs text-slate-600">{step.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatPill({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-inner shadow-slate-100">
      <div className={`text-lg font-semibold bg-clip-text text-transparent bg-gradient-to-r ${accent}`}>
        {value}
      </div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-600">{label}</p>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
      {children}
    </span>
  );
}

function FuturisticBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-10 top-10 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="absolute right-10 top-20 h-64 w-64 rounded-full bg-sky-500/20 blur-3xl" />
      <div className="absolute inset-x-0 top-1/3 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent" />
    </div>
  );
}

function ClockBadge() {
  return (
    <div className="relative h-4 w-4">
      <div className="absolute inset-0 rounded-full border border-slate-500/70" />
      <div className="absolute left-1/2 top-1/2 h-2 w-[1px] -translate-x-1/2 -translate-y-1/2 rotate-45 origin-bottom bg-emerald-300" />
    </div>
  );
}
