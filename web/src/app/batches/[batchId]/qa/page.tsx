'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CORE_TEMP_LIMIT } from '@/config/qa';

type Stage = 'preparation' | 'mixing' | 'marination' | 'drying' | 'packaging' | 'final';
type QAStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional';

type CheckpointVm = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stage: Stage;
  required: boolean;
  display_order: number;
  status: QAStatus;
  metadata: Record<string, unknown> | null;
  check_id: string | null;
};

// ----- Special card types
type CoreTempReading = { tempC: number | ''; minutes: number | '' };
type CoreTempMeta = { readings: [CoreTempReading, CoreTempReading, CoreTempReading] };

type MarTimesMeta = { startISO: string; endISO: string; tempC: number | '' };
type AwMeta = { aw: number | '' };

// ----- Helpers
async function saveCheckpoint(batchId: string, checkpointId: string, status: QAStatus, metadata?: Record<string, unknown>) {
  const res = await fetch(`/api/batches/${batchId}/qa/${checkpointId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, metadata }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? 'Failed to save');
  }
}

const STAGE_ORDER: Stage[] = ['preparation', 'mixing', 'marination', 'drying', 'packaging', 'final'];

// ----- Special Cards
function CoreTempCard({
  initialMeta,
  onSave,
}: {
  initialMeta?: CoreTempMeta;
  onSave: (meta: CoreTempMeta, passed: boolean) => Promise<void>;
}) {
  const [readings, setReadings] = useState<CoreTempMeta['readings']>(
    initialMeta?.readings ?? [
      { tempC: '', minutes: '' },
      { tempC: '', minutes: '' },
      { tempC: '', minutes: '' },
    ]
  );

  const update = (i: 0 | 1 | 2, field: keyof CoreTempReading, v: string) => {
    const next = readings.map((r, idx) =>
      idx === i ? { ...r, [field]: v === '' ? '' : Number(v) } : r
    ) as CoreTempMeta['readings'];
    setReadings(next);
  };

  const allEntered = readings.every(r => r.tempC !== '' && r.minutes !== '');
  const passed = allEntered && readings.every(r =>
    Number(r.tempC) >= CORE_TEMP_LIMIT.tempC && Number(r.minutes) >= CORE_TEMP_LIMIT.minutes
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['Probe 1','Probe 2','Probe 3'] as const).map((label, i) => (
          <div key={label} className="rounded-lg border p-3">
            <div className="text-sm font-medium mb-2">{label}</div>
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="decimal"
                placeholder="Temp (°C)"
                value={readings[i as 0|1|2].tempC}
                onChange={(e) => update(i as 0|1|2, 'tempC', e.target.value)}
                className="w-1/2 border rounded px-2 py-1"
              />
              <input
                type="number"
                inputMode="decimal"
                placeholder="Hold (min)"
                value={readings[i as 0|1|2].minutes}
                onChange={(e) => update(i as 0|1|2, 'minutes', e.target.value)}
                className="w-1/2 border rounded px-2 py-1"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-600">
          Limit: ≥ {CORE_TEMP_LIMIT.tempC} °C for ≥ {CORE_TEMP_LIMIT.minutes} min (each probe)
        </div>
        <span className={`px-2 py-1 rounded ${
          !allEntered ? 'bg-gray-100 text-gray-600'
          : passed ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-700'
        }`}>
          {!allEntered ? 'Awaiting readings' : passed ? 'PASS' : 'FAIL'}
        </span>
      </div>

      <div className="text-right">
        <button
          disabled={!allEntered}
          onClick={() => onSave({ readings }, Boolean(passed))}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          Save readings
        </button>
      </div>
    </div>
  );
}

function MarinationTimesCard({
  initialMeta,
  onSave,
}: {
  initialMeta?: MarTimesMeta;
  onSave: (meta: MarTimesMeta, passed: boolean) => Promise<void>;
}) {
  const [m, setM] = useState<MarTimesMeta>(
    initialMeta ?? { startISO: '', endISO: '', tempC: '' }
  );
  const complete = Boolean(m.startISO && m.endISO && m.tempC !== '');
  const passed = complete && Number(m.tempC) <= 5;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input type="datetime-local" value={m.startISO}
          onChange={e => setM({ ...m, startISO: e.target.value })}
          className="border rounded px-2 py-1" />
        <input type="datetime-local" value={m.endISO}
          onChange={e => setM({ ...m, endISO: e.target.value })}
          className="border rounded px-2 py-1" />
        <input type="number" inputMode="decimal" placeholder="Chill °C" value={m.tempC}
          onChange={e => setM({ ...m, tempC: e.target.value === '' ? '' : Number(e.target.value) })}
          className="border rounded px-2 py-1" />
      </div>
      <div className="text-right">
        <button
          disabled={!complete}
          onClick={() => onSave(m, passed)}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function WaterActivityCard({
  initialMeta, onSave,
}: { initialMeta?: AwMeta; onSave: (m: AwMeta, passed: boolean)=>Promise<void> }) {
  const [m, setM] = useState<AwMeta>(initialMeta ?? { aw: '' });
  const entered = m.aw !== '';
  const passed = entered && Number(m.aw) <= 0.85;
  return (
    <div className="space-y-3">
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        placeholder="a_w"
        value={m.aw}
        onChange={e => setM({ aw: e.target.value === '' ? '' : Number(e.target.value) })}
        className="border rounded px-2 py-1 w-40"
      />
      <div className="text-right">
        <button
          disabled={!entered}
          onClick={() => onSave(m, passed)}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

// Simple status card for non-special checkpoints
function SimpleStatusCard({
  initialStatus,
  onSave,
  labelYes = 'Pass',
  labelNo = 'Fail',
}: {
  initialStatus: QAStatus;
  onSave: (status: QAStatus) => Promise<void>;
  labelYes?: string;
  labelNo?: string;
}) {
  const [status, setStatus] = useState<QAStatus>(initialStatus);

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value as QAStatus)}
        className="border rounded px-2 py-1"
      >
        <option value="pending">Pending</option>
        <option value="passed">{labelYes}</option>
        <option value="failed">{labelNo}</option>
        <option value="skipped">Skipped</option>
        <option value="conditional">Conditional</option>
      </select>
      <button
        onClick={() => onSave(status)}
        className="px-3 py-1 rounded bg-blue-600 text-white"
      >
        Save
      </button>
    </div>
  );
}

// ----- Page
export default function BatchQA() {
  const params = useParams();
  const batchId = params.batchId as string;

  const [items, setItems] = useState<CheckpointVm[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/batches/${batchId}/qa`);
    const j = await res.json();
    setItems(j.checkpoints as CheckpointVm[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [batchId]);

  const grouped = useMemo(() => {
    const by: Record<Stage, CheckpointVm[]> = {
      preparation: [], mixing: [], marination: [], drying: [], packaging: [], final: []
    };
    (items ?? []).forEach(c => by[c.stage].push(c));
    return by;
  }, [items]);

  if (loading) return <div className="p-6">Loading QA…</div>;
  if (!items)   return <div className="p-6">No checkpoints found.</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">QA Checks</h1>

      {STAGE_ORDER.map((stage) => {
        const rows = grouped[stage].sort((a, b) => a.display_order - b.display_order);
        if (!rows.length) return null;
        return (
          <section key={stage} className="space-y-4">
            <h2 className="text-xl font-semibold capitalize">{stage}</h2>

            <div className="grid gap-4">
              {rows.map((cp) => {
                const baseCard = (
                  <div key={cp.id} className="rounded-lg border p-4 bg-white">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold">{cp.name}</div>
                        {cp.description && (
                          <div className="text-sm text-gray-600 mt-1">{cp.description}</div>
                        )}
                        {cp.required && (
                          <div className="mt-2 inline-block text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            Required
                          </div>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${
                        cp.status === 'passed' ? 'bg-green-100 text-green-700'
                        : cp.status === 'failed' ? 'bg-red-100 text-red-700'
                        : cp.status === 'skipped' ? 'bg-gray-100 text-gray-700'
                        : cp.status === 'conditional' ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>
                        {cp.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="mt-4">
                      {cp.code === 'DRY-CORE' ? (
                        <CoreTempCard
                          initialMeta={cp.metadata as CoreTempMeta | undefined}
                          onSave={async (meta, passed) => {
                            await saveCheckpoint(batchId, cp.id, passed ? 'passed' : 'failed', meta);
                            await load();
                          }}
                        />
                      ) : cp.code === 'MAR-TIMES' ? (
                        <MarinationTimesCard
                          initialMeta={cp.metadata as MarTimesMeta | undefined}
                          onSave={async (meta, passed) => {
                            await saveCheckpoint(batchId, cp.id, passed ? 'passed' : 'failed', meta);
                            await load();
                          }}
                        />
                      ) : cp.code === 'DRY-AW' ? (
                        <WaterActivityCard
                          initialMeta={cp.metadata as AwMeta | undefined}
                          onSave={async (meta, passed) => {
                            await saveCheckpoint(batchId, cp.id, passed ? 'passed' : 'failed', meta);
                            await load();
                          }}
                        />
                      ) : (
                        <SimpleStatusCard
                          initialStatus={cp.status}
                          onSave={async (status) => {
                            await saveCheckpoint(batchId, cp.id, status);
                            await load();
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
                return baseCard;
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
