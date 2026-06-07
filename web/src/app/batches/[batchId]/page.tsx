'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Check, Loader2, Trash2 } from 'lucide-react';
import { AiFillEdit } from 'react-icons/ai';
import { FaDeleteLeft } from 'react-icons/fa6';
import Breadcrumbs from '@/components/Breadcrumbs';
import DeleteBatchModal from '@/components/DeleteBatchModal';
import RecallModal from '@/components/RecallModal';
import { useToast } from '@/components/ToastProvider';
import { computeBestBefore, formatDate, formatQuantity } from '@/lib/utils';
import {
  CURE_BY_ID,
  DEFAULT_CURE_SETTINGS,
  calculatePpm,
  calculateRequiredCureGrams,
  evaluateCureStatus,
  type CurePpmSettings,
  type CureStatus,
  type CureType,
} from '@/lib/cure';

/* =========================================
   Types
   ========================================= */
type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

const toGrams = (value: number, unit: Unit): number => {
  if (!Number.isFinite(value)) return 0;
  if (unit === 'kg') return value * 1000;
  return value;
};

const fromGrams = (value: number, unit: Unit): number => {
  if (!Number.isFinite(value)) return 0;
  if (unit === 'kg') return value / 1000;
  return value;
};

const formatNumericInput = (value: number, unit: Unit): string => {
  if (!Number.isFinite(value)) return '';
  let decimals = 2;
  if (unit === 'kg' || unit === 'L') decimals = 3;
  else if (unit === 'ml') decimals = 1;
  else if (unit === 'units') decimals = 0;
  const rounded = Number(value.toFixed(decimals));
  return decimals === 0 ? Math.round(rounded).toString() : rounded.toString();
};

const formatDeltaGrams = (delta: number): string => {
  if (!Number.isFinite(delta) || delta === 0) return '±0.0 g';
  const sign = delta > 0 ? '+' : '-';
  return `${sign}${Math.abs(delta).toFixed(1)} g`;
};

const CURE_STATUS_BADGES: Record<CureStatus, { label: string; className: string }> = {
  LOW: { label: 'Low ppm', className: 'bg-amber-100 text-amber-700' },
  OK: { label: 'Within spec', className: 'bg-emerald-100 text-emerald-700' },
  HIGH: { label: 'High ppm', className: 'bg-rose-100 text-rose-700' },
};

interface MaterialTraceRow {
  material_id: string;
  material_name: string;
  unit: Unit;
  target_amount: number;
  used_amount: number;
  remaining_amount: number;
  is_critical: boolean;
  tolerance_percentage: number;
  is_cure?: boolean | null;
  cure_type?: CureType | null;
  cure_nitrite_percent?: number | null;
  cure_required_grams?: number | null;
  cure_ppm_target?: number | null;
  cure_base_mass_grams?: number | null;
  lots: unknown[];
}

interface TraceResp {
  batch?: { id?: string; recipe_id?: string | null; scale?: number };
  materials?: MaterialTraceRow[];
  cure_settings?: Partial<CurePpmSettings> | null;
  cure_mass_basis_grams?: number | null;
  total_non_cure_mass_grams?: number | null;
  target_non_cure_mass_grams?: number | null;
  actual_non_cure_mass_grams?: number | null;
  actual_beef_mass_grams?: number | null;
  beef_mass_grams_used?: number | null;
  fallback_beef_mass_grams?: number | null;
}

type BatchStatus = 'in_progress' | 'completed' | 'cancelled' | 'released';

interface BatchDetails {
  id: string;
  batch_id: string;
  batch_number?: string | null;
  recipe_id: string | null;
  beef_weight_kg: number;
  scaling_factor: number | null;
  production_date: string | null;
  created_at?: string | null;
  best_before_date?: string | null;
  status: BatchStatus;
  release_status?: 'pending' | 'approved' | 'rejected' | 'hold' | 'recalled' | null;
  recall_reason?: string | null;
  recall_notes?: string | null;
  recipe?: { name: string; recipe_code: string };
}

const resolveBatchDisplayId = (batch: BatchDetails | null | undefined): string =>
  batch?.batch_id ?? batch?.batch_number ?? batch?.id ?? 'Batch';

interface BatchResp {
  batch?: BatchDetails;
}

interface ActualRow {
  id: string;
  material_id: string | null;
  ingredient_name: string;
  target_amount: number;
  actual_amount: number | null;
  unit: Unit;
  tolerance_percentage: number;
  in_tolerance: boolean | null;
  measured_at: string | null;
  is_cure?: boolean | null;
  cure_type?: CureType | null;
  cure_ppm?: number | null;
  cure_status?: CureStatus | null;
  cure_required_grams?: number | null;
  cure_unit?: Unit;
  cure_base_mass_grams?: number | null;
}

interface ActualsResp {
  actuals?: ActualRow[];
}

type QaStage =
  | 'preparation'
  | 'mixing'
  | 'marination'
  | 'drying'
  | 'packaging'
  | 'final';

interface QaStageCount {
  stage: QaStage;
  total: number;
  done: number;
}

interface QaSummaryResp {
  current_stage: QaStage;
  percent_complete: number;
  counts: QaStageCount[];
  current_checkpoint?: { id: string; code: string; name: string; stage: QaStage } | null;
}

type QaStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional';

interface QaCheckpointReport {
  id: string;
  code: string;
  name: string;
  stage: QaStage;
  status: QaStatus;
  last_checked_at: string | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  ph_level: number | null;
  water_activity: number | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  description?: string | null;
}

interface BeefAllocationReport {
  id: string;
  lot_id: string;
  quantity_used: number;
  unit: string;
  allocated_at: string;
  lot?:
    | {
        lot_number?: string | null;
        internal_lot_code?: string | null;
        unit?: string | null;
        supplier?: { name?: string | null } | null;
      }
    | null;
}

type CoreTempReadingMeta = { tempC?: number | ''; minutes?: number | '' };
type MarinationTimesMeta = { tempC?: number | ''; startISO?: string | null; endISO?: string | null };

// Beef allocation types
type BeefPick = {
  id: string;
  lot_number: string;
  internal_lot_code: string;
  current_balance: number;
  unit: 'g' | 'kg' | 'ml' | 'L' | 'units';
  supplier_name: string | null;
  received_date: string | null;
  expiry_date: string | null;
};

/* handy guard */
function isOkResponse(res: Response) {
  return res.ok && res.headers.get('content-type')?.includes('application/json');
}

/* =========================================
   Component
   ========================================= */
export default function BatchDetailPage() {
  const params = useParams<{ batchId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const batchId = params.batchId;
  const toast = useToast();

  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [scale, setScale] = useState<number>(1);
  const [materials, setMaterials] = useState<MaterialTraceRow[]>([]);
  const [actuals, setActuals] = useState<Record<string, ActualRow>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedFlash, setSavedFlash] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [recallLoading, setRecallLoading] = useState(false);
  const [recallError, setRecallError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [cureSettings, setCureSettings] = useState<CurePpmSettings>(DEFAULT_CURE_SETTINGS);
  const [autoExportQueued, setAutoExportQueued] = useState(false);

  const [qaSummary, setQaSummary] = useState<QaSummaryResp | null>(null);
  const [actualInputs, setActualInputs] = useState<Record<string, string>>({});

  // Beef allocations state
  const [beefLots, setBeefLots] = useState<BeefPick[]>([]);
  const [beefQuery, setBeefQuery] = useState('');
  const [selectedLotId, setSelectedLotId] = useState<string>('');
  const [selectedLot, setSelectedLot] = useState<BeefPick | null>(null);
  const [beefQty, setBeefQty] = useState<number>(0);
  const [beefUnit, setBeefUnit] = useState<'g' | 'kg'>('g');
  const [beefTotalG, setBeefTotalG] = useState<number>(0);
  const [beefAllocationRows, setBeefAllocationRows] = useState<BeefAllocationReport[]>([]);
  const [editingBeefAllocationId, setEditingBeefAllocationId] = useState<string | null>(null);
  const [editingBeefQuantity, setEditingBeefQuantity] = useState<string>('');
  const [editingBeefUnit, setEditingBeefUnit] = useState<'g' | 'kg'>('g');
  const [beefAllocationBusyId, setBeefAllocationBusyId] = useState<string | null>(null);

  const fetchBatch = async () => {
    const [bRes, tRes, aRes, qRes] = await Promise.all([
      fetch(`/api/batches/${batchId}`),
      fetch(`/api/batches/${batchId}/traceability`),
      fetch(`/api/batches/${batchId}/ingredients/actuals`),
      fetch(`/api/batches/${batchId}/qa/progress`).catch(() => new Response(null, { status: 404 })),
    ]);

    if (isOkResponse(bRes)) {
      const bJson = (await bRes.json()) as BatchResp;
      setBatch(bJson.batch ?? null);
    } else {
      setBatch(null);
    }

    let traceMaterials: MaterialTraceRow[] = [];

    if (isOkResponse(tRes)) {
      const traceJson = (await tRes.json()) as TraceResp;
      traceMaterials = Array.isArray(traceJson?.materials) ? traceJson.materials ?? [] : [];
      const nextScale =
        typeof traceJson?.batch?.scale === 'number' ? Number(traceJson.batch?.scale) : 1;
      setScale(nextScale);
      setMaterials(traceMaterials);
      const overrides = traceJson?.cure_settings ?? {};
      const normalized: CurePpmSettings = { ...DEFAULT_CURE_SETTINGS };
      (['cure_ppm_min', 'cure_ppm_target', 'cure_ppm_max'] as const).forEach((key) => {
        const raw = overrides?.[key];
        const parsed =
          typeof raw === 'number'
            ? raw
            : typeof raw === 'string'
            ? Number.parseFloat(raw)
            : null;
        if (parsed != null && Number.isFinite(parsed)) {
          normalized[key] = parsed;
        }
      });
      setCureSettings(normalized);
    } else {
      setScale(1);
      setMaterials([]);
      setCureSettings(DEFAULT_CURE_SETTINGS);
    }

    if (isOkResponse(aRes)) {
      const aJson = (await aRes.json()) as ActualsResp;
      const map: Record<string, ActualRow> = {};
      for (const row of aJson.actuals ?? []) {
        if (row.material_id) map[row.material_id] = row;
      }
      setActuals(map);

      const seed: Record<string, string> = {};
      const materialsForSeed =
        traceMaterials.length > 0 ? traceMaterials : Array.isArray(materials) ? materials : [];
      for (const m of materialsForSeed) {
        const actualRow = map[m.material_id];
        const actualAmount = actualRow?.actual_amount;
        const actualUnit = (actualRow?.unit as Unit | undefined) ?? m.unit;
        if (typeof actualAmount === 'number' && actualAmount > 0) {
          seed[m.material_id] = formatNumericInput(actualAmount, actualUnit);
        } else if (m.is_cure && typeof m.target_amount === 'number' && m.target_amount > 0) {
          seed[m.material_id] = formatNumericInput(m.target_amount, m.unit);
        } else {
          seed[m.material_id] = '';
        }
      }
      setActualInputs(seed);
    } else {
      setActuals({});
      setActualInputs({});
    }

    if (isOkResponse(qRes)) {
      const qJson = (await qRes.json()) as QaSummaryResp;
      setQaSummary(qJson);
    } else {
      setQaSummary(null);
    }
  };

  const handleRecallSubmit = async (reason: string, notes: string) => {
    setRecallError(null);
    setRecallLoading(true);
    try {
      const res = await fetch(`/api/batches/${batchId}/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, notes }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const message = body.error ?? 'Failed to mark batch as recalled.';
        setRecallError(message);
        return false;
      }

      await fetchBatch();
      toast.success('Batch marked as recalled.');
      setShowRecallModal(false);
      return true;
    } catch (error) {
      setRecallError(error instanceof Error ? error.message : 'Failed to mark batch as recalled.');
      return false;
    } finally {
      setRecallLoading(false);
    }
  };

  const handleCloseRecallModal = () => {
    if (recallLoading) return;
    setShowRecallModal(false);
    setRecallError(null);
  };

  const loadBeefAllocations = async () => {
    try {
      const res = await fetch(`/api/batches/${batchId}/beef`);
      const data = (await res.json().catch(() => ({}))) as {
        allocations?: BeefAllocationReport[];
        total_g?: number;
        error?: string;
      };

      if (res.ok) {
        setBeefTotalG(Number(data.total_g ?? 0));
        setBeefAllocationRows(Array.isArray(data.allocations) ? data.allocations : []);
      } else {
        console.error('Failed to load beef allocations', data.error);
        setBeefAllocationRows([]);
      }
    } catch (error) {
      console.error('Error fetching beef allocations', error);
      setBeefAllocationRows([]);
    }
  };

  const formatLotOption = (lot: BeefPick) =>
    `${lot.lot_number}${lot.internal_lot_code ? ` (${lot.internal_lot_code})` : ''}`.trim();

  const searchBeefLots = async (term: string) => {
    const trimmed = term.trim();

    if (trimmed.length === 0) {
      // Clear list for very short searches to avoid hammering the API when it cannot filter
      setBeefLots([]);
      setSelectedLotId('');
      setSelectedLot(null);
      return [];
    }

    try {
      const res = await fetch(`/api/lots?category=beef&q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) {
        console.error('Failed to load beef lots', data);
        return [];
      }
      const mapped: BeefPick[] = (data.lots ?? []).map((l: {
        id: string;
        lot_number: string;
        internal_lot_code: string;
        current_balance: number;
        unit: string;
        supplier?: { name: string } | null;
        received_date?: string | null;
        expiry_date?: string | null;
      }) => ({
        id: l.id,
        lot_number: l.lot_number,
        internal_lot_code: l.internal_lot_code,
        current_balance: Number(l.current_balance) || 0,
        unit: l.unit as BeefPick['unit'],
        supplier_name: l.supplier?.name ?? null,
        received_date: l.received_date ?? null,
        expiry_date: l.expiry_date ?? null,
      }));
      setBeefLots(mapped);
      if (selectedLotId) {
        const match = mapped.find((lot) => lot.id === selectedLotId);
        if (match) {
          setSelectedLot(match);
        }
      }
      return mapped;
    } catch (error) {
      console.error('Error fetching beef lots', error);
      return [];
    }
  };

  const handleLotInputChange = async (value: string) => {
    setBeefQuery(value);

    const normalized = value.trim().toLowerCase();
    const localMatch = beefLots.find((lot) => formatLotOption(lot).toLowerCase() === normalized);

    if (localMatch) {
      setSelectedLotId(localMatch.id);
      setSelectedLot(localMatch);
      return;
    }

    const fetched = await searchBeefLots(value);
    const fetchedMatch = fetched.find(
      (lot) => formatLotOption(lot).toLowerCase() === normalized,
    );
    if (fetchedMatch) {
      setSelectedLotId(fetchedMatch.id);
      setSelectedLot(fetchedMatch);
    } else {
      setSelectedLotId('');
      setSelectedLot(null);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        await fetchBatch();
      } finally {
        setLoading(false);
      }
    })();
      }, [batchId]);

  useEffect(() => {
    if (searchParams.get('export') === '1') {
      setAutoExportQueued(true);
    }
      }, [searchParams, batchId]);

  useEffect(() => {
    if (autoExportQueued && !loading && !exporting && batch) {
      void handleExportPdf();
      setAutoExportQueued(false);
    }
      }, [autoExportQueued, loading, exporting, batch]);

  useEffect(() => {
    loadBeefAllocations();
      }, [batchId]);

  useEffect(() => {
    searchBeefLots(beefQuery);
      }, []);

  const addBeef = async () => {
    if (!selectedLotId || beefQty <= 0) return;

    const res = await fetch(`/api/batches/${batchId}/beef`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lot_id: selectedLotId, quantity: beefQty, unit: beefUnit }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to add beef');
      return;
    }

    await Promise.all([loadBeefAllocations(), fetchBatch()]);
    setSelectedLotId('');
    setSelectedLot(null);
    setBeefQty(0);
    setBeefUnit('g');
    setBeefQuery('');
    await searchBeefLots('');
    toast.success('Beef allocation recorded.');
  };

  const startEditingBeefAllocation = (allocation: BeefAllocationReport) => {
    const defaultUnit: 'g' | 'kg' = allocation.quantity_used >= 1000 ? 'kg' : 'g';
    const value =
      defaultUnit === 'kg'
        ? formatNumericInput(allocation.quantity_used / 1000, defaultUnit)
        : formatNumericInput(allocation.quantity_used, defaultUnit);

    setEditingBeefAllocationId(allocation.id);
    setEditingBeefQuantity(value);
    setEditingBeefUnit(defaultUnit);
  };

  const cancelEditingBeefAllocation = () => {
    setEditingBeefAllocationId(null);
    setEditingBeefQuantity('');
    setEditingBeefUnit('g');
  };

  const submitBeefAllocationEdit = async () => {
    if (!editingBeefAllocationId) return;
    const nextQuantity = Number(editingBeefQuantity);
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
      toast.error('Enter a positive quantity to update this allocation.');
      return;
    }

    setBeefAllocationBusyId(editingBeefAllocationId);
    try {
      const res = await fetch(`/api/batches/${batchId}/beef`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usage_id: editingBeefAllocationId,
          quantity: nextQuantity,
          unit: editingBeefUnit,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok !== true) {
        toast.error(data.error ?? 'Failed to update beef allocation.');
        return;
      }
      await Promise.all([loadBeefAllocations(), fetchBatch()]);
      cancelEditingBeefAllocation();
      toast.success('Beef allocation updated.');
    } finally {
      setBeefAllocationBusyId(null);
    }
  };

  const handleDeleteBeefAllocation = async (allocation: BeefAllocationReport) => {
    if (!confirm('Remove this beef allocation?')) return;

    setBeefAllocationBusyId(allocation.id);
    try {
      const res = await fetch(
        `/api/batches/${batchId}/traceability?usage_id=${allocation.id}`,
        { method: 'DELETE' }
      );
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok !== true) {
        toast.error(data.error ?? 'Failed to remove beef allocation.');
        return;
      }
      if (editingBeefAllocationId === allocation.id) {
        cancelEditingBeefAllocation();
      }
      await Promise.all([loadBeefAllocations(), fetchBatch()]);
      toast.success('Beef allocation removed.');
    } finally {
      setBeefAllocationBusyId(null);
    }
  };

  const lotHref = (lotId: string): `/lots/${string}` => `/lots/${lotId}`;

  const handleGoToLot = (lotId: string) => {
    router.push(lotHref(lotId));
  };

  const handleExportPdf = async () => {
    if (!batch) return;

    setExporting(true);

    try {
      const jsPDFModule = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');

      const { jsPDF } = jsPDFModule;
      const autoTableFn = autoTableModule.default;

      if (typeof autoTableFn !== 'function') {
        throw new Error('PDF export module failed to load');
      }

      const [qaRes, beefRes] = await Promise.all([
        fetch(`/api/batches/${batchId}/qa`),
        fetch(`/api/batches/${batchId}/beef`),
      ]);

      if (!qaRes.ok) {
        throw new Error('Unable to load QA data for export.');
      }

      if (!beefRes.ok) {
        throw new Error('Unable to load beef allocation data for export.');
      }

      const qaJson = (await qaRes.json()) as { checkpoints?: QaCheckpointReport[] };
      const beefJson = (await beefRes.json()) as {
        allocations?: BeefAllocationReport[];
        total_g?: number;
      };

      const qaCheckpoints = Array.isArray(qaJson.checkpoints) ? qaJson.checkpoints : [];
      const beefAllocations = Array.isArray(beefJson.allocations) ? beefJson.allocations : [];
      const recordedBeefTotal =
        typeof beefJson.total_g === 'number' ? beefJson.total_g : beefTotalG;
      const formatStatus = (value: BatchStatus) =>
        value
          .split('_')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');

      const formatDateTime = (value: string | null | undefined) => {
        if (!value) return '-';
        const dt = new Date(value);
        return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleString();
      };

      const parseNumeric = (value: unknown): number | null => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      };

      const weightSnapshot = qaCheckpoints.reduce<{
        wetKg: number | null;
        dryKg: number | null;
        lossPercent: number | null;
        checkpointLabel: string | null;
        checkedAt: string | null;
        score: number;
        ts: number;
      }>(
        (best, checkpoint) => {
          const metadata =
            checkpoint.metadata && typeof checkpoint.metadata === 'object'
              ? (checkpoint.metadata as Record<string, unknown>)
              : null;
          const rawWeightLog =
            metadata && typeof metadata['weight_log'] === 'object'
              ? (metadata['weight_log'] as Record<string, unknown>)
              : null;
          if (!rawWeightLog) return best;

          const wet = parseNumeric(rawWeightLog['wet_weight_kg']);
          const dry = parseNumeric(rawWeightLog['dry_weight_kg']);
          const lossRaw = parseNumeric(rawWeightLog['weight_loss_percent']);
          const loss =
            lossRaw != null
              ? lossRaw
              : wet != null && dry != null && wet > 0
              ? ((wet - dry) / wet) * 100
              : null;
          const score =
            (wet != null ? 1 : 0) + (dry != null ? 2 : 0) + (loss != null ? 4 : 0);
          if (score === 0) return best;

          const ts =
            checkpoint.last_checked_at && Number.isFinite(Date.parse(checkpoint.last_checked_at))
              ? Date.parse(checkpoint.last_checked_at)
              : Number.NEGATIVE_INFINITY;

          if (score > best.score || (score === best.score && ts > best.ts)) {
            const checkpointLabel = [checkpoint.code, checkpoint.name]
              .filter(Boolean)
              .join(' - ');
            return {
              wetKg: wet,
              dryKg: dry,
              lossPercent: loss,
              checkpointLabel: checkpointLabel || checkpoint.code || checkpoint.name || null,
              checkedAt: checkpoint.last_checked_at,
              score,
              ts,
            };
          }
          return best;
        },
        {
          wetKg: null,
          dryKg: null,
          lossPercent: null,
          checkpointLabel: null,
          checkedAt: null,
          score: -1,
          ts: Number.NEGATIVE_INFINITY,
        },
      );

      const beefQaByLot: Array<{
        lot_number: string;
        internal_code: string;
        temp: string;
        packaging: string;
        odour: string;
        visual: string;
        result: string;
        checkedAt: string;
      }> = [];
      const seenLots = new Set<string>();
      for (const alloc of beefAllocations) {
        const lot = Array.isArray(alloc.lot) ? alloc.lot[0] : alloc.lot;
        if (!lot || !lot.id || seenLots.has(lot.id)) continue;
        seenLots.add(lot.id);
        const coa =
          lot.certificate_of_analysis && typeof lot.certificate_of_analysis === 'object'
            ? (lot.certificate_of_analysis as Record<string, unknown>)
            : {};
        const temp = typeof coa['receiving_temp_c'] === 'number' ? `${coa['receiving_temp_c']} °C` : '-';
        const packaging = coa['packaging_intact'] === false ? 'Fail' : coa['packaging_intact'] === true ? 'OK' : '-';
        const odour = coa['odour_ok'] === false ? 'Fail' : coa['odour_ok'] === true ? 'OK' : '-';
        const visual = coa['visual_ok'] === false ? 'Fail' : coa['visual_ok'] === true ? 'OK' : '-';
        const result = lot.passed_receiving_qa === false ? 'Fail' : lot.passed_receiving_qa === true ? 'Pass' : '-';
        const checkedAt =
          typeof coa['check_time'] === 'string' ? formatDateTime(coa['check_time']) : '';
        beefQaByLot.push({
          lot_number: lot.lot_number,
          internal_code: lot.internal_lot_code,
          temp,
          packaging,
          odour,
          visual,
          result,
          checkedAt,
        });
      }

      const formatTemperatures = (checkpoint: QaCheckpointReport) => {
        const parts: string[] = [];
        if (checkpoint.temperature_c != null) {
          parts.push(`${Number(checkpoint.temperature_c).toFixed(1)} deg C`);
        }

        const meta = checkpoint.metadata ?? null;
        if (meta && typeof meta === 'object') {
          const metaRecord = meta as Record<string, unknown>;

          if ('tempC' in metaRecord && typeof metaRecord.tempC === 'number') {
            parts.push(`${Number(metaRecord.tempC).toFixed(1)} deg C`);
          }

          if ('readings' in metaRecord && Array.isArray(metaRecord.readings)) {
            const readings = metaRecord.readings as CoreTempReadingMeta[];
            readings.forEach((reading, idx) => {
              const tempValue =
                typeof reading?.tempC === 'number' ? reading.tempC : null;
              const holdValue =
                typeof reading?.minutes === 'number' ? reading.minutes : null;
              if (tempValue != null || holdValue != null) {
                const labels: string[] = [];
                if (tempValue != null) {
                  labels.push(`${tempValue.toFixed(1)} deg C`);
                }
                if (holdValue != null) {
                  labels.push(`${holdValue.toFixed(0)} min`);
                }
                if (labels.length > 0) {
                  parts.push(`Probe ${idx + 1}: ${labels.join(' / ')}`);
                }
              }
            });
          }

          const marMeta = metaRecord as MarinationTimesMeta;
          if (typeof marMeta?.tempC === 'number') {
            parts.push(`${marMeta.tempC.toFixed(1)} deg C`);
          }
        }

        return parts.length ? parts.join('; ') : '—';
      };

        const formatOtherMeasurements = (checkpoint: QaCheckpointReport) => {
          const metrics: string[] = [];
          if (checkpoint.humidity_percent != null) {
            metrics.push(`Humidity ${Number(checkpoint.humidity_percent).toFixed(1)} %`);
          }
          if (checkpoint.water_activity != null) {
            metrics.push(`aw ${Number(checkpoint.water_activity).toFixed(3)}`);
          }
          if (checkpoint.ph_level != null) {
            metrics.push(`pH ${Number(checkpoint.ph_level).toFixed(2)}`);
          }

          const meta = checkpoint.metadata ?? null;
          if (meta && typeof meta === 'object') {
            const metaRecord = meta as Record<string, unknown>;
            if ('aw' in metaRecord && typeof metaRecord.aw === 'number') {
              metrics.push(`aw ${Number(metaRecord.aw).toFixed(3)}`);
            }
            if ('weight_log' in metaRecord && typeof metaRecord.weight_log === 'object') {
              const wl = metaRecord.weight_log as Record<string, unknown>;
              const wet =
                typeof wl.wet_weight_kg === 'number'
                  ? wl.wet_weight_kg
                  : typeof wl.wet_weight_kg === 'string'
                  ? Number(wl.wet_weight_kg)
                  : null;
              const dry =
                typeof wl.dry_weight_kg === 'number'
                  ? wl.dry_weight_kg
                  : typeof wl.dry_weight_kg === 'string'
                  ? Number(wl.dry_weight_kg)
                  : null;
              const loss =
                typeof wl.weight_loss_percent === 'number'
                  ? wl.weight_loss_percent
                  : typeof wl.weight_loss_percent === 'string'
                  ? Number(wl.weight_loss_percent)
                  : wet && dry && wet > 0
                  ? ((wet - dry) / wet) * 100
                  : null;
              const weightPieces = [
                wet != null && Number.isFinite(wet) ? `wet ${wet.toFixed(2)} kg` : null,
                dry != null && Number.isFinite(dry) ? `dry ${dry.toFixed(2)} kg` : null,
                loss != null && Number.isFinite(loss) ? `water loss ${loss.toFixed(1)}%` : null,
              ].filter(Boolean);
              if (weightPieces.length > 0) {
                metrics.push(`Weight ${weightPieces.join(', ')}`);
              }
            }

            const marMeta = metaRecord as MarinationTimesMeta;
            const startLabelRaw = marMeta.startISO ? formatDateTime(marMeta.startISO) : '';
          const endLabelRaw = marMeta.endISO ? formatDateTime(marMeta.endISO) : '';
          const startLabel = startLabelRaw === '-' ? '' : startLabelRaw;
          const endLabel = endLabelRaw === '-' ? '' : endLabelRaw;
          if (startLabel || endLabel) {
            const windowLabel = [startLabel, endLabel].filter(Boolean).join(' -> ');
            if (windowLabel) {
              metrics.push(`Marination ${windowLabel}`);
            }
          }

          const dryingRun = metaRecord['drying_run'];
          if (dryingRun && typeof dryingRun === 'object') {
            const ovenValue =
              typeof dryingRun['oven_temp_c'] === 'number'
                ? dryingRun['oven_temp_c']
                : typeof dryingRun['oven_temp_c'] === 'string'
                ? Number(dryingRun['oven_temp_c'])
                : null;
            if (Number.isFinite(ovenValue)) {
              metrics.push(`Oven ${Number(ovenValue).toFixed(1)} deg C`);
            }
            const startIso =
              typeof dryingRun['start_iso'] === 'string'
                ? (dryingRun['start_iso'] as string)
                : typeof dryingRun['startISO'] === 'string'
                ? (dryingRun['startISO'] as string)
                : null;
            const endIso =
              typeof dryingRun['end_iso'] === 'string'
                ? (dryingRun['end_iso'] as string)
                : typeof dryingRun['endISO'] === 'string'
                ? (dryingRun['endISO'] as string)
                : null;
            const startLabel = startIso ? formatDateTime(startIso) : '';
            const endLabel = endIso ? formatDateTime(endIso) : '';
            if (startLabel || endLabel) {
              const label = [startLabel, endLabel].filter(Boolean).join(' -> ');
              if (label) {
                metrics.push(`Drying ${label}`);
              }
            }
            if (startIso && endIso) {
              const startTs = Date.parse(startIso);
              const endTs = Date.parse(endIso);
              if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs > startTs) {
                const minutes = Math.round((endTs - startTs) / 60000);
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                const durationLabel = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
                metrics.push(`Duration ${durationLabel}`);
              }
            }
          }
        }

        return metrics.length ? metrics.join('; ') : '-';
      };

      const toQaRow = (checkpoint: QaCheckpointReport) => {
        const checkpointLabel = [checkpoint.code, checkpoint.name]
          .filter(Boolean)
          .join(' - ');
        return [
          checkpointLabel || 'Checkpoint',
          prettyStage(checkpoint.stage),
          checkpoint.status ? checkpoint.status.toUpperCase() : 'PENDING',
          formatTemperatures(checkpoint),
          formatOtherMeasurements(checkpoint),
          formatDateTime(checkpoint.last_checked_at),
        ];
      };

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const marginLeft = 14;
      let cursorY = 18;

      const batchLabel = resolveBatchDisplayId(batch);
      const bestBeforeDate =
        batch.best_before_date && new Date(batch.best_before_date)
          ? new Date(batch.best_before_date)
          : computeBestBefore(batch.production_date ?? batch.created_at ?? null);
      const bestBeforeText =
        bestBeforeDate && !Number.isNaN(bestBeforeDate.getTime())
          ? formatDate(bestBeforeDate)
          : 'Not set';
      doc.setFontSize(16);
      doc.text(`Batch ${batchLabel}`, marginLeft, cursorY);
      cursorY += 6;

      doc.setFontSize(10);
      const summaryLines = [
        `Recipe: ${batch.recipe?.name ?? 'N/A'}${
          batch.recipe?.recipe_code ? ` (${batch.recipe.recipe_code})` : ''
        }`,
        `Production Date: ${formatDateTime(batch.production_date).split(',')[0]}`,
        `Best Before: ${bestBeforeText}`,
        `Status: ${formatStatus(batch.status)}`,
        `Scale: ${scale.toFixed(2)} x`,
        `Beef Input: ${Number(batch.beef_weight_kg).toFixed(2)} kg`,
        `Beef Recorded: ${Number(recordedBeefTotal).toFixed(0)} g`,
      ];

      if (qaSummary) {
        summaryLines.push(
          `QA Progress: ${prettyStage(qaSummary.current_stage)} at ${qaSummary.percent_complete.toFixed(0)}%`,
        );
      }

      summaryLines.forEach((line) => {
        doc.text(line, marginLeft, cursorY);
        cursorY += 5;
      });

      cursorY += 2;

      const pageWidth = doc.internal.pageSize.getWidth();
      const boxWidth = pageWidth - marginLeft * 2;
      const boxHeight = 24;
      const lossLabel =
        weightSnapshot.lossPercent != null && Number.isFinite(weightSnapshot.lossPercent)
          ? `${weightSnapshot.lossPercent.toFixed(1)}% Weight Loss`
          : 'Weight Loss Not Recorded';
      const wetLabel =
        weightSnapshot.wetKg != null && Number.isFinite(weightSnapshot.wetKg)
          ? `${weightSnapshot.wetKg.toFixed(2)} kg`
          : 'Not recorded';
      const dryLabel =
        weightSnapshot.dryKg != null && Number.isFinite(weightSnapshot.dryKg)
          ? `${weightSnapshot.dryKg.toFixed(2)} kg`
          : 'Not recorded';
      const sourceParts = [
        weightSnapshot.checkpointLabel,
        weightSnapshot.checkedAt ? formatDateTime(weightSnapshot.checkedAt) : null,
      ].filter(Boolean);

      doc.setDrawColor(30, 64, 175);
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(marginLeft, cursorY, boxWidth, boxHeight, 2, 2, 'FD');
      doc.setTextColor(30, 64, 175);
      doc.setFontSize(10);
      doc.text('Weight Loss Summary', marginLeft + 3, cursorY + 5);
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(16);
      doc.text(lossLabel, marginLeft + 3, cursorY + 12);
      doc.setFontSize(10);
      doc.text(`Start (wet): ${wetLabel}`, marginLeft + 3, cursorY + 18);
      doc.text(`Finish (dry): ${dryLabel}`, marginLeft + boxWidth / 2, cursorY + 18);
      if (sourceParts.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`Source: ${sourceParts.join(' @ ')}`, marginLeft + 3, cursorY + 22);
      }

      cursorY += boxHeight + 6;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(12);
      doc.text('Ingredients', marginLeft, cursorY);
      cursorY += 2;

      const ingredientRows = materials.map((material) => {
        const actualRow = actuals[material.material_id];
        const actualAmount = actualRow?.actual_amount ?? null;
        const tolerance = actualRow?.tolerance_percentage ?? material.tolerance_percentage;
        const actualUnit = actualRow?.unit ?? material.unit;

        const actualLabel =
          actualAmount == null
            ? '—'
            : `${Number(actualAmount).toFixed(2)} ${actualUnit}`;
        const statusLabel =
          actualRow?.in_tolerance === true
            ? 'OK'
            : actualRow?.in_tolerance === false
            ? 'Out'
            : actualAmount != null
            ? 'Pending'
            : 'Not recorded';

        return [
          material.material_name,
          `${Number(material.target_amount).toFixed(2)} ${material.unit}`,
          actualLabel,
          `${Number(tolerance).toFixed(1)} %`,
          material.is_critical ? 'Yes' : 'No',
          statusLabel,
        ];
      });

      autoTableFn(doc, {
        startY: cursorY + 4,
        head: [['Ingredient', 'Target', 'Actual', 'Tolerance', 'Critical', 'Status']],
        body: ingredientRows,
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      });

      const getLastTableBottom = () => {
        const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
        return lastTable?.finalY ?? cursorY;
      };

      cursorY = getLastTableBottom() + 8;

      doc.setFontSize(12);
      doc.text('QA Measurements', marginLeft, cursorY);
      cursorY += 4;

      const qaRows = qaCheckpoints.map(toQaRow);

      if (qaRows.length > 0) {
        autoTableFn(doc, {
          startY: cursorY,
          head: [['Checkpoint', 'Stage', 'Status', 'Temperatures', 'Other Readings', 'Checked At']],
          body: qaRows,
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [30, 64, 175], textColor: 255 },
        });
        cursorY = getLastTableBottom() + 8;
      } else {
        doc.setFontSize(10);
        doc.text('No QA measurements recorded.', marginLeft, cursorY);
        cursorY += 8;
      }

      doc.setFontSize(12);
      doc.text('Beef Allocations', marginLeft, cursorY);
      cursorY += 4;

      if (beefAllocations.length > 0) {
        const beefRows = beefAllocations.map((allocation) => {
          const lot = allocation.lot ?? null;
          const supplier =
            lot?.supplier && typeof lot.supplier === 'object'
              ? (lot.supplier as { name?: string | null }).name ?? null
              : null;
          return [
            lot?.lot_number ?? '—',
            lot?.internal_lot_code ?? '—',
            `${Number(allocation.quantity_used ?? 0).toFixed(0)} g`,
            supplier ?? '—',
            formatDateTime(allocation.allocated_at),
          ];
        });

        autoTableFn(doc, {
          startY: cursorY,
          head: [['Lot Number', 'Internal Code', 'Quantity', 'Supplier', 'Allocated At']],
          body: beefRows,
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [22, 101, 52], textColor: 255 },
        });
        cursorY = getLastTableBottom() + 8;
      } else {
        doc.setFontSize(10);
        doc.text('No beef allocations recorded.', marginLeft, cursorY);
        cursorY += 8;
      }

      doc.setFontSize(12);
      doc.text('Beef QA Checks', marginLeft, cursorY);
      cursorY += 4;

      if (beefQaByLot.length > 0) {
        const beefQaRows = beefQaByLot.map((row) => [
          row.lot_number ?? '-',
          row.internal_code ?? '-',
          row.temp,
          row.packaging,
          row.odour,
          row.visual,
          row.result,
          row.checkedAt || '-',
        ]);
        autoTableFn(doc, {
          startY: cursorY,
          head: [
            ['Lot #', 'Internal Code', 'Receiving Temp', 'Packaging', 'Odour', 'Visual', 'Result', 'Checked At'],
          ],
          body: beefQaRows,
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: [59, 7, 100], textColor: 255 },
        });
      } else {
        doc.setFontSize(10);
        doc.text('No beef receiving QA recorded from lots.', marginLeft, cursorY);
      }

      const filename = `${batchLabel}-batch-report.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error('Failed to export batch PDF', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred while exporting the PDF.'
      );
    } finally {
      setExporting(false);
    }
  };

  const isLocked =
    batch?.status === 'released' || batch?.status === 'completed';

  const cureMaterial = useMemo(
    () => materials.find((m) => m.is_cure),
    [materials]
  );

  const baseBeefGrams = useMemo(() => {
    if (!batch) return 0;
    const beefKg = Number(batch.beef_weight_kg);
    return Number.isFinite(beefKg) ? beefKg * 1000 : 0;
  }, [batch]);

  const cureSummary = useMemo(() => {
    if (!cureMaterial || !cureMaterial.cure_type) {
      return null;
    }

    const ppmTarget = Number(
      cureMaterial.cure_ppm_target ??
        cureSettings.cure_ppm_target ??
        DEFAULT_CURE_SETTINGS.cure_ppm_target
    );

    const massBasis =
      typeof cureMaterial.cure_base_mass_grams === 'number' &&
      Number.isFinite(cureMaterial.cure_base_mass_grams) &&
      cureMaterial.cure_base_mass_grams > 0
        ? cureMaterial.cure_base_mass_grams
        : baseBeefGrams > 0
        ? baseBeefGrams
        : 0;

    if (massBasis <= 0) {
      return null;
    }

    const actualRow = actuals[cureMaterial.material_id];

    const requiredGramsRaw =
      typeof cureMaterial.cure_required_grams === 'number' &&
      Number.isFinite(cureMaterial.cure_required_grams) &&
      cureMaterial.cure_required_grams > 0
        ? cureMaterial.cure_required_grams
        : typeof actualRow?.cure_required_grams === 'number' &&
          Number.isFinite(actualRow.cure_required_grams) &&
          actualRow.cure_required_grams > 0
        ? actualRow.cure_required_grams
        : calculateRequiredCureGrams(massBasis, cureMaterial.cure_type, ppmTarget);
    const requiredGrams = Math.max(0, requiredGramsRaw);
    const requiredInUnit = fromGrams(requiredGrams, cureMaterial.unit);

    const actualAmount = actualRow?.actual_amount ?? null;
    const actualUnit = (actualRow?.unit as Unit | undefined) ?? cureMaterial.unit;
    const actualInGrams =
      actualAmount != null ? toGrams(actualAmount, actualUnit) : null;
    const totalMassForActual =
      actualInGrams != null ? massBasis + actualInGrams : massBasis;
    const ppm =
      actualRow?.cure_ppm ??
      (actualInGrams != null && totalMassForActual > 0
        ? calculatePpm(actualInGrams, totalMassForActual, cureMaterial.cure_type)
        : null);
    const status =
      actualRow?.cure_status ??
      (ppm != null ? evaluateCureStatus(ppm, cureSettings) : null);
    const deltaGrams =
      actualInGrams != null ? actualInGrams - requiredGrams : null;

    return {
      materialId: cureMaterial.material_id,
      materialName: cureMaterial.material_name,
      cureType: cureMaterial.cure_type,
      requiredGrams,
      requiredInUnit,
      unit: cureMaterial.unit,
      ppm,
      status,
      actualAmount,
      actualUnit,
      actualInGrams,
      deltaGrams,
      baseMassGrams: massBasis,
      lastMeasuredAt: actualRow?.measured_at ?? null,
      targetPpm: ppmTarget,
    };
  }, [cureMaterial, baseBeefGrams, cureSettings, actuals]);

  const rows = useMemo(() => {
    return materials.map((m) => {
      const a = actuals[m.material_id];
      const tol = a?.tolerance_percentage ?? m.tolerance_percentage;

      const raw = actualInputs[m.material_id];
      const actualVal =
        raw !== undefined && raw !== '' ? Number(raw) : a?.actual_amount ?? null;

      const target =
        m.is_cure && cureSummary && cureSummary.materialId === m.material_id
          ? cureSummary.requiredInUnit
          : m.target_amount;
      const diffPct =
        actualVal != null && target > 0
          ? (Math.abs(actualVal - target) / target) * 100
          : null;
      const inTol = diffPct == null ? null : diffPct <= tol;

      return {
        ...m,
        tol,
        actualVal,
        diffPct,
        inTol,
      };
    });
  }, [materials, actuals, actualInputs, cureSummary]);

  const saveActual = useCallback(
    async (
      material_id: string,
      unit: Unit,
      opts?: { overrideAmount?: number; overrideTolerance?: number; silent?: boolean; overrideComment?: string }
    ) => {
      const rawFromState = actualInputs[material_id];
      const hasOverride = typeof opts?.overrideAmount === 'number';
      const amt = hasOverride ? Number(opts?.overrideAmount) : Number(rawFromState);
      if (!Number.isFinite(amt) || amt <= 0) {
        if (!opts?.silent) {
          toast.error('Please enter a positive number.');
        }
        return false;
      }

      const body: Record<string, unknown> = {
        material_id,
        actual_amount: amt,
        unit,
        recorded_by: opts?.overrideComment ? `Override: ${opts.overrideComment}` : 'UI',
      };

      if (typeof opts?.overrideTolerance === 'number' && opts.overrideTolerance > 0) {
        body.tolerance_percentage = opts.overrideTolerance;
      }

      setSaving((s) => ({ ...s, [material_id]: true }));
      try {
        const res = await fetch(`/api/batches/${batchId}/ingredients/actuals`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const j = (await res.json().catch(() => ({}))) as { actual?: ActualRow; error?: string };
        if (!res.ok || !j.actual) {
          if (!opts?.silent) {
            toast.error(j.error ?? 'Failed to save actual');
          } else {
            console.error('Failed to save cure actual', j.error);
          }
          return false;
        }
        const responseUnit = (j.actual.unit as Unit | undefined) ?? unit;
        setActuals((prev) => ({ ...prev, [material_id]: j.actual }));
        setActualInputs((prev) => ({
          ...prev,
          [material_id]: formatNumericInput(amt, responseUnit),
        }));
        setSavedFlash((f) => ({ ...f, [material_id]: true }));
        setTimeout(() => {
          setSavedFlash((f) => ({ ...f, [material_id]: false }));
        }, 1200);
        return true;
      } finally {
        setSaving((s) => ({ ...s, [material_id]: false }));
      }
    },
    [actualInputs, batchId, toast]
  );

  const allCriticalOk = useMemo(() => {
    if (rows.length === 0) return false;
    const criticals = rows.filter((r) => r.is_critical);
    if (criticals.length === 0) return true;
    return criticals.every((r) => r.inTol === true);
  }, [rows]);

  const [overrideDialog, setOverrideDialog] = useState<{
    materialId: string;
    unit: Unit;
    actualVal: number;
    diffPct: number;
  } | null>(null);
  const [overrideComment, setOverrideComment] = useState('');

  const overrideOutOfTolerance = useCallback(
    async (materialId: string, unit: Unit, actualVal: number | null, diffPct: number | null) => {
      if (!Number.isFinite(actualVal ?? NaN) || !actualVal || actualVal <= 0) {
        toast.error('Record an actual amount before overriding.');
        return;
      }
      if (diffPct == null) {
        toast.error('Unable to determine the deviation for this ingredient.');
        return;
      }
      setOverrideDialog({ materialId, unit, actualVal, diffPct });
      setOverrideComment('');
    },
    [toast]
  );

  const confirmOverride = useCallback(async () => {
    if (!overrideDialog) return;
    const { materialId, unit, actualVal, diffPct } = overrideDialog;
    const overrideTolerance = diffPct + 0.1;
    if (!overrideComment.trim()) {
      toast.error('Please add a short comment for the override.');
      return;
    }
    const ok = await saveActual(materialId, unit, {
      overrideAmount: actualVal,
      overrideTolerance,
      overrideComment: overrideComment.trim(),
    });
    if (ok) {
      toast.success('Override recorded. Ingredient marked in tolerance.');
      setOverrideDialog(null);
      setOverrideComment('');
    }
  }, [overrideDialog, overrideComment, saveActual, toast]);

  useEffect(() => {
    if (!cureSummary || !cureSummary.materialId) return;
    if (!Number.isFinite(cureSummary.requiredInUnit) || cureSummary.requiredInUnit <= 0) return;
    const actualRow = actuals[cureSummary.materialId];
    if (actualRow?.actual_amount != null && actualRow.actual_amount > 0) return;
    setActualInputs((prev) => {
      const current = prev[cureSummary.materialId];
      if (current && current.trim().length > 0) {
        return prev;
      }
      return {
        ...prev,
        [cureSummary.materialId]: formatNumericInput(cureSummary.requiredInUnit, cureSummary.unit),
      };
    });
  }, [cureSummary, actuals]);

  async function completeBatch() {
    if (!batch) return;
    if (!allCriticalOk) {
      const proceed = confirm(
        'Some critical ingredients are missing or out of tolerance. Complete anyway?'
      );
      if (!proceed) return;
    }
    const res = await fetch(`/api/batches/${batchId}/complete`, { method: 'POST' });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; status?: BatchStatus };
    if (!res.ok || j.ok !== true) {
      toast.error(j.error ?? 'Failed to complete batch');
      return;
    }
    const nextStatus = j.status === 'released' ? 'completed' : j.status ?? 'completed';
    setBatch((b) => (b ? { ...b, status: nextStatus } : b));
    toast.success('Batch marked as completed.');
  }

  const stageOrder: QaStage[] = [
    'preparation',
    'mixing',
    'marination',
    'drying',
    'packaging',
    'final',
  ];

  const QA_STAGE_BADGE: Record<QaStage, string> = {
    preparation: 'bg-slate-100 text-slate-700',
    mixing: 'bg-blue-100 text-blue-700',
    marination: 'bg-amber-100 text-amber-700',
    drying: 'bg-orange-100 text-orange-700',
    packaging: 'bg-indigo-100 text-indigo-700',
    final: 'bg-emerald-100 text-emerald-700',
  };

  const DEFAULT_STATUS_BADGES: Record<BatchStatus, { label: string; className: string }> = {
    in_progress: { label: 'In progress', className: 'bg-yellow-100 text-yellow-700' },
    completed: { label: 'Completed', className: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
    released: { label: 'QA Complete', className: 'bg-green-100 text-green-700' },
  };

  function qaBadge(summary: QaSummaryResp | null, status: BatchStatus) {
    const checkpoint = summary?.current_checkpoint
      ? [summary.current_checkpoint.code, summary.current_checkpoint.name]
          .filter((part) => typeof part === 'string' && part.trim().length > 0)
          .join(' - ')
      : null;

    if (!summary) {
      const fallback = DEFAULT_STATUS_BADGES[status] ?? {
        label: status.replace('_', ' '),
        className: 'bg-yellow-100 text-yellow-700',
      };
      return fallback;
    }

    const percent = Number.isFinite(summary.percent_complete)
      ? summary.percent_complete
      : Number(summary.percent_complete ?? 0);

    if (percent >= 100 || summary.current_stage === 'final') {
      return { label: 'QA Complete', className: 'bg-green-100 text-green-700' };
    }

    const stage = summary.current_stage;
    if (checkpoint) {
      const className = stage ? (QA_STAGE_BADGE[stage] ?? 'bg-gray-100 text-gray-700') : 'bg-yellow-100 text-yellow-700';
      return { label: `Next: ${checkpoint}`, className };
    }

    if (stage) {
      const className = QA_STAGE_BADGE[stage] ?? 'bg-gray-100 text-gray-700';
      return { label: prettyStage(stage), className };
    }

    return { label: status.replace('_', ' '), className: 'bg-yellow-100 text-yellow-700' };
  }

  function prettyStage(s: QaStage) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  const formatLocalDate = (value: string | null | undefined) => {
    if (!value) return '—';
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString();
  };

  const formatLocalDateTime = (value: string | null | undefined) => {
    if (!value) return '—';
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12">Loading batch…</div>
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12">Batch not found</div>
      </div>
    );
  }

  const batchDisplayId = resolveBatchDisplayId(batch);

  return (
    <div className="min-h-screen bg-gray-50">
      {overrideDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setOverrideDialog(null);
              setOverrideComment('');
            }
          }}
        >
          <div className="w-full rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl">
            {/* Mobile drag handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="h-1 w-10 rounded-full bg-gray-300" />
            </div>

            <div className="px-6 pt-4 pb-6 sm:p-6">
              <h3 className="text-xl font-bold text-slate-900">Override out-of-tolerance</h3>
              <p className="mt-2 text-sm text-slate-600">
                This marks the ingredient as in tolerance by widening the tolerance limit. A justification is required.
              </p>

              <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Actual amount</span>
                  <span className="font-bold text-slate-900 tabular-nums">{overrideDialog.actualVal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Current deviation</span>
                  <span className="font-bold text-rose-600 tabular-nums">{overrideDialog.diffPct.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Proposed tolerance</span>
                  <span className="font-bold text-emerald-600 tabular-nums">{(overrideDialog.diffPct + 0.1).toFixed(2)}%</span>
                </div>
              </div>

              <div className="mt-5">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                  Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={overrideComment}
                  onChange={(e) => setOverrideComment(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-100 resize-none"
                  rows={3}
                  placeholder="Why is this override acceptable?"
                  autoFocus
                />
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                  onClick={() => {
                    setOverrideDialog(null);
                    setOverrideComment('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="w-full sm:w-auto rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-md shadow-emerald-200"
                  onClick={() => void confirmOverride()}
                >
                  Confirm override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/' },
            { label: 'Batches', href: '/batches' },
            { label: batchDisplayId, href: `/batches/${batchId}` },
          ]}
        />

        {/* Hero header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Batch</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 font-mono break-all">{batchDisplayId}</h1>
            {batch.recipe && (
              <p className="mt-1 text-sm text-slate-500">
                {batch.recipe.name} <span className="text-slate-400">· {batch.recipe.recipe_code}</span>
              </p>
            )}
          </div>
          <div className="shrink-0">
            {(() => {
              const badge = qaBadge(qaSummary, batch.status);
              return (
                <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${badge.className}`}>
                  {badge.label}
                </span>
              );
            })()}
          </div>
        </div>

        {batch.release_status === 'recalled' && (
          <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900">
            <p className="font-semibold">This batch has been recalled.</p>
            {batch.recall_reason && <p className="mt-1">{batch.recall_reason}</p>}
            {batch.recall_notes && <p className="mt-1 text-purple-800">{batch.recall_notes}</p>}
          </div>
        )}

        {/* Batch + Stage Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 mb-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="p-4 rounded-xl bg-slate-50">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Production date</p>
                <p className="text-base font-bold text-slate-900 mt-1">{formatLocalDate(batch.production_date)}</p>
              </div>
              <div className="p-4 rounded-xl bg-rose-50">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Beef weight</p>
                <p className="text-base font-bold text-slate-900 mt-1 tabular-nums">{Number(batch.beef_weight_kg).toFixed(2)} kg</p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 col-span-2 lg:col-span-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Recipe scale</p>
                <p className="text-base font-bold text-slate-900 mt-1 tabular-nums">{scale.toFixed(2)}×</p>
              </div>
            </div>

          {qaSummary && (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">QA progress</h3>
                  <p className="text-base font-semibold text-slate-900 mt-1">
                    {prettyStage(qaSummary.current_stage)}
                    <span className="ml-2 text-emerald-600 tabular-nums">{qaSummary.percent_complete.toFixed(0)}%</span>
                  </p>
                </div>
                {qaSummary.current_checkpoint && qaSummary.current_stage !== 'final' && (
                  <div className="text-xs text-slate-500 sm:text-right">
                    Next: <span className="font-semibold text-slate-700">{qaSummary.current_checkpoint.code}</span> — {qaSummary.current_checkpoint.name}
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="h-2 w-full rounded-full bg-slate-100 mb-3 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
                  style={{ width: `${qaSummary.percent_complete}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {stageOrder.map((s, i) => {
                  const doneUpTo =
                    stageOrder.indexOf(qaSummary.current_stage) > i ||
                    qaSummary.percent_complete === 100;
                  const isCurrent = qaSummary.current_stage === s && qaSummary.percent_complete < 100;

                  return (
                    <div key={s} className="flex items-center gap-1.5">
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          isCurrent
                            ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                            : doneUpTo
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {prettyStage(s)}
                      </div>
                      {i < stageOrder.length - 1 && (
                        <div className={`h-0.5 w-4 ${doneUpTo ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {cureSummary && (
            <div className="mt-6 border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Cure Status</h3>
                <span
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    cureSummary.status
                      ? CURE_STATUS_BADGES[cureSummary.status]?.className ??
                        'bg-gray-100 text-gray-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {cureSummary.status
                    ? CURE_STATUS_BADGES[cureSummary.status]?.label ?? cureSummary.status
                    : 'Awaiting measurement'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="p-4 rounded-lg bg-purple-50">
                  <p className="text-xs uppercase text-purple-600">Cure</p>
                  <p className="mt-1 font-semibold text-purple-900">
                    {CURE_BY_ID[cureSummary.cureType]?.label ?? cureSummary.cureType?.toUpperCase()}
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    Target {Number(cureSummary.targetPpm).toFixed(0)} ppm
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Required</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {formatNumericInput(cureSummary.requiredInUnit, cureSummary.unit)} {cureSummary.unit}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {cureSummary.requiredGrams.toFixed(2)} g total
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Actual</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {cureSummary.actualAmount != null
                      ? `${formatNumericInput(cureSummary.actualAmount, cureSummary.actualUnit)} ${cureSummary.actualUnit}`
                      : 'Awaiting entry'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Last entry:{' '}
                    {cureSummary.lastMeasuredAt
                      ? formatLocalDateTime(cureSummary.lastMeasuredAt)
                      : '—'}
                  </p>
                  {cureSummary.deltaGrams != null && (
                    <p className="text-xs text-slate-500 mt-1">
                      Deviation: {formatDeltaGrams(cureSummary.deltaGrams)}
                    </p>
                  )}
                </div>
                <div className="p-4 rounded-lg bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Calculated PPM</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {cureSummary.ppm != null ? cureSummary.ppm.toFixed(0) : '—'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Basis: {cureSummary.baseMassGrams > 0 ? (cureSummary.baseMassGrams / 1000).toFixed(2) : '—'} kg
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Beef used (traceability link) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 mb-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Beef allocation</h2>
              <p className="text-sm text-slate-500">Link beef lots used in this batch for full traceability.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-4 py-1.5 text-sm font-semibold text-rose-700 border border-rose-100">
              Total: <span className="tabular-nums">{beefTotalG.toFixed(0)} g</span>
              {beefTotalG >= 1000 && <span className="text-rose-500">({(beefTotalG / 1000).toFixed(2)} kg)</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-6">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Beef lot</label>
              <input
                list="beef-lot-options"
                value={beefQuery}
                onChange={(e) => void handleLotInputChange(e.target.value)}
                placeholder="Start typing lot number..."
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              />
              <datalist id="beef-lot-options">
                {beefLots.map((lot) => (
                  <option
                    key={lot.id}
                    value={formatLotOption(lot)}
                    label={`Balance ${formatQuantity(lot.current_balance, lot.unit)}${
                      lot.supplier_name ? ` - ${lot.supplier_name}` : ''
                    }`}
                  />
                ))}
              </datalist>
              {selectedLot ? (
                <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800">
                  <span className="font-semibold">Balance:</span> {formatQuantity(selectedLot.current_balance, selectedLot.unit)}
                  {selectedLot.supplier_name && <> · <span className="font-semibold">Supplier:</span> {selectedLot.supplier_name}</>}
                  {selectedLot.received_date && <> · <span className="font-semibold">Received:</span> {new Date(selectedLot.received_date).toLocaleDateString('en-AU')}</>}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">Choose a lot from the list to continue.</p>
              )}
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Quantity</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={Number.isFinite(beefQty) ? beefQty : 0}
                onChange={(e) => setBeefQty(Number(e.target.value))}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-xl font-bold tabular-nums focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                placeholder="0"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Unit</label>
              <select
                value={beefUnit}
                onChange={(e) => setBeefUnit(e.target.value === 'kg' ? 'kg' : 'g')}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-base font-medium focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-100"
              >
                <option value="g">grams (g)</option>
                <option value="kg">kilograms (kg)</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={addBeef}
              disabled={!selectedLotId || beefQty <= 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-200 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
            >
              + Add beef allocation
            </button>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Recorded allocations</h3>
            {beefAllocationRows.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No beef allocations recorded yet. Add a lot above to see it listed here.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                {beefAllocationRows.map((allocation) => {
                  const lotName = allocation.lot?.lot_number ?? 'Lot';
                  const lotCode = allocation.lot?.internal_lot_code ?? null;
                  const supplierName = allocation.lot?.supplier?.name ?? null;
                  const isEditing = editingBeefAllocationId === allocation.id;
                  const isBusy = beefAllocationBusyId === allocation.id;
                  const quantityLabel = formatQuantity(allocation.quantity_used, 'g');
                  const quantityInKgLabel =
                    allocation.quantity_used >= 1000
                      ? formatQuantity(allocation.quantity_used, 'kg')
                      : null;

                  return (
                    <div
                      key={allocation.id}
                      className="rounded-lg border border-slate-200 bg-slate-50/60 p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <button
                            type="button"
                            onClick={() => handleGoToLot(allocation.lot_id)}
                            className="text-left text-sm font-semibold text-slate-800 hover:text-indigo-600"
                          >
                            {lotName}
                            {lotCode ? ` · ${lotCode}` : ''}
                          </button>
                          <div className="mt-1 text-xs text-gray-500">
                            {supplierName ? `${supplierName} • ` : ''}
                            {quantityLabel}
                            {quantityInKgLabel ? ` (${quantityInKgLabel})` : ''} •{' '}
                            {formatLocalDateTime(allocation.allocated_at)}
                          </div>
                        </div>
                        {!isEditing && (
                          <div className="flex items-center gap-2 self-start md:self-center">
                            <button
                              type="button"
                              onClick={() => startEditingBeefAllocation(allocation)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                              aria-label="Edit allocation"
                              disabled={isBusy}
                            >
                              <AiFillEdit className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteBeefAllocation(allocation)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                              aria-label="Remove allocation"
                              disabled={isBusy}
                            >
                              {isBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FaDeleteLeft className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing && (
                        <div className="mt-3 flex flex-wrap items-end gap-3">
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                              New amount
                            </label>
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={editingBeefUnit === 'kg' ? 0.001 : 1}
                              value={editingBeefQuantity}
                              onChange={(e) => setEditingBeefQuantity(e.target.value)}
                              className="w-32 rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-base font-bold tabular-nums focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                              disabled={isBusy}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                              Unit
                            </label>
                            <select
                              value={editingBeefUnit}
                              onChange={(e) =>
                                setEditingBeefUnit(e.target.value === 'kg' ? 'kg' : 'g')
                              }
                              className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-base font-medium focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                              disabled={isBusy}
                            >
                              <option value="g">g</option>
                              <option value="kg">kg</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={submitBeefAllocationEdit}
                              disabled={isBusy}
                              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50"
                            >
                              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingBeefAllocation}
                              disabled={isBusy}
                              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recipe Targets & Actuals */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Ingredients</h2>
              <p className="text-sm text-slate-500">Record the actual weight measured for each ingredient.</p>
            </div>
            {isLocked && (
              <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {batch.status === 'completed' ? 'Completed — editing disabled' : 'Released — editing disabled'}
              </span>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">
              No recipe ingredients found.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {rows.map((r) => {
                const isCureRow = Boolean(r.is_cure);
                const cureRowMatch =
                  isCureRow && cureSummary?.materialId === r.material_id;
                const cureDetails = cureRowMatch ? cureSummary : null;
                const targetUnitLabel = (cureDetails?.unit ?? r.unit) as Unit;
                const displayValue = actualInputs[r.material_id] ?? '';
                const numericDisplay = Number(displayValue);
                const disableInput = isLocked;
                const disableSave =
                  isLocked ||
                  saving[r.material_id] === true ||
                  displayValue.trim() === '' ||
                  Number.isNaN(numericDisplay) ||
                  numericDisplay <= 0;
                const targetAmountDisplay = formatNumericInput(
                  cureDetails ? cureDetails.requiredInUnit : r.target_amount,
                  targetUnitLabel
                );
                const cureStatus = cureDetails?.status ?? null;
                const curePpmLabel =
                  cureDetails?.ppm != null ? `${cureDetails.ppm.toFixed(0)} ppm` : 'PPM pending';
                const cureDeltaLabel =
                  cureDetails?.deltaGrams != null ? formatDeltaGrams(cureDetails.deltaGrams) : null;
                const cureBaseMassLabel =
                  cureDetails?.baseMassGrams != null && cureDetails.baseMassGrams > 0
                    ? `${(cureDetails.baseMassGrams / 1000).toFixed(2)} kg base`
                    : null;
                const recommendedDisplay = formatNumericInput(
                  cureDetails ? cureDetails.requiredInUnit : r.target_amount,
                  targetUnitLabel
                );

                // Border / accent based on status
                const accentBorder = cureStatus
                  ? cureStatus === 'OK'
                    ? 'border-emerald-300 ring-1 ring-emerald-100'
                    : cureStatus === 'LOW'
                    ? 'border-amber-300 ring-1 ring-amber-100'
                    : 'border-rose-300 ring-1 ring-rose-100'
                  : r.actualVal == null || r.actualVal === 0
                  ? 'border-slate-200'
                  : r.inTol
                  ? 'border-emerald-300 ring-1 ring-emerald-100'
                  : 'border-rose-300 ring-1 ring-rose-100';

                return (
                  <div
                    key={r.material_id}
                    className={`rounded-2xl border bg-white p-5 transition ${accentBorder}`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-slate-900 leading-tight">{r.material_name}</h3>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {r.is_critical && (
                            <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                              Critical
                            </span>
                          )}
                          {isCureRow && r.cure_type && (
                            <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                              Cure: {CURE_BY_ID[r.cure_type]?.label ?? r.cure_type.toUpperCase()}
                            </span>
                          )}
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            ±{r.tol}%
                          </span>
                        </div>
                      </div>

                      {/* Status pill */}
                      <div className="shrink-0">
                        {cureStatus ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                              CURE_STATUS_BADGES[cureStatus]?.className ??
                              'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {CURE_STATUS_BADGES[cureStatus]?.label ?? cureStatus}
                          </span>
                        ) : r.actualVal == null || r.actualVal === 0 ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                            Pending
                          </span>
                        ) : r.inTol ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                            <Check className="w-3.5 h-3.5" />
                            In tolerance
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                            Out of tolerance
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Target display */}
                    <div className="mb-3 flex items-baseline justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target</span>
                      <span className="text-lg font-bold text-slate-900 tabular-nums">
                        {targetAmountDisplay} <span className="text-sm font-medium text-slate-500">{targetUnitLabel}</span>
                      </span>
                    </div>

                    {/* Input */}
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                      Actual used
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="0.01"
                          value={displayValue}
                          onChange={(e) =>
                            setActualInputs((prev) => ({
                              ...prev,
                              [r.material_id]: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                          className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-xl font-bold text-slate-900 tabular-nums placeholder:text-slate-300 focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:cursor-not-allowed"
                          disabled={disableInput}
                        />
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                          {targetUnitLabel}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveActual(r.material_id, targetUnitLabel)}
                        disabled={disableSave}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition shadow-md shadow-emerald-200 ${
                          savedFlash[r.material_id]
                            ? 'bg-emerald-500'
                            : saving[r.material_id]
                            ? 'bg-emerald-400'
                            : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                        } disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed`}
                      >
                        {saving[r.material_id] ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : savedFlash[r.material_id] ? (
                          <>
                            <Check className="w-5 h-5" />
                            Saved
                          </>
                        ) : (
                          'Save'
                        )}
                      </button>
                    </div>

                    {/* Cure recommendation */}
                    {cureRowMatch && cureDetails && (
                      <p className="mt-2 text-xs text-purple-700">
                        Recommended: <span className="font-semibold">{recommendedDisplay} {targetUnitLabel}</span>
                        {cureDetails.requiredGrams > 0 && cureDetails.baseMassGrams > 0
                          ? ` (${cureDetails.requiredGrams.toFixed(1)} g on ${(cureDetails.baseMassGrams / 1000).toFixed(2)} kg base)`
                          : ''}
                      </p>
                    )}

                    {/* Cure details */}
                    {cureRowMatch && cureDetails && (
                      <div className="mt-3 rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 text-xs text-purple-800 flex flex-wrap gap-x-3 gap-y-1">
                        <span className="font-semibold">{curePpmLabel}</span>
                        {cureDeltaLabel && <span>· {cureDeltaLabel}</span>}
                        {cureBaseMassLabel && <span>· {cureBaseMassLabel}</span>}
                      </div>
                    )}

                    {/* Override action when out of tolerance */}
                    {!cureStatus && r.actualVal != null && r.actualVal > 0 && r.inTol === false && (
                      <button
                        type="button"
                        onClick={() =>
                          void overrideOutOfTolerance(
                            r.material_id,
                            targetUnitLabel,
                            r.actualVal,
                            r.diffPct
                          )
                        }
                        disabled={saving[r.material_id]}
                        className="mt-3 w-full rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 active:bg-rose-200 disabled:opacity-50"
                      >
                        Override to in tolerance
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {!isLocked && (
              <button
                onClick={completeBatch}
                className={`order-first w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition ${
                  allCriticalOk
                    ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-200'
                    : 'bg-amber-500 hover:bg-amber-600 active:bg-amber-700 shadow-amber-200'
                }`}
                title={
                  allCriticalOk
                    ? 'Complete batch'
                    : 'Some critical ingredients are missing or out of tolerance'
                }
              >
                <Check className="w-4 h-4" />
                {allCriticalOk ? 'Complete batch' : 'Complete (with warnings)'}
              </button>
            )}

            <button
              onClick={() => router.push(`/qa/${batchId}` as `/qa/${string}`)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100"
            >
              QA management
            </button>

            <button
              onClick={() => void handleExportPdf()}
              disabled={exporting}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-60"
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Exporting…
                </>
              ) : (
                'Export PDF'
              )}
            </button>

            <button
              onClick={() => router.push(`/recipe/print/${batchId}` as `/recipe/print/${string}`)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100"
            >
              Print record
            </button>

            {batch.release_status && batch.release_status !== 'recalled' && (
              <button
                onClick={() => {
                  setShowRecallModal(true);
                  setRecallError(null);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-semibold text-purple-700 hover:bg-purple-100 active:bg-purple-200"
              >
                Recall batch
              </button>
            )}

            <button
              onClick={() => setShowDeleteModal(true)}
              className="sm:ml-auto inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100 active:bg-rose-200"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <RecallModal
        isOpen={showRecallModal}
        onClose={handleCloseRecallModal}
        onSubmit={handleRecallSubmit}
        loading={recallLoading}
        error={recallError}
        entityLabel={batchDisplayId}
        title="Recall batch"
        description="This will flag the batch as recalled and alert downstream reports."
      />

      <DeleteBatchModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={async () => {
          const res = await fetch(`/api/batches/${batchId}/delete`, { method: 'DELETE' });
          if (!res.ok) throw new Error('Failed to delete batch');
          router.push('/batches');
        }}
        batchNumber={batchDisplayId}
      />
    </div>
  );
}
