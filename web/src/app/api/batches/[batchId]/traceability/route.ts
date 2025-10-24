import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import {
  CURE_BY_ID,
  DEFAULT_CURE_SETTINGS,
  calculateRequiredCureGrams,
  parseCureNote,
} from '@/lib/cure';
import type { CurePpmSettings } from '@/lib/cure';

// Keep unit handling tight and explicit
type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  // weight
  if (from === 'kg' && to === 'g') return value * 1000;
  if (from === 'g' && to === 'kg') return value / 1000;
  // volume
  if (from === 'L' && to === 'ml') return value * 1000;
  if (from === 'ml' && to === 'L') return value / 1000;
  // "units" or mismatched systems -> return unchanged
  return value;
}

/* ===========================
   Types for row shapes we use
   =========================== */

type SupplierRel =
  | { name: string | null }
  | Array<{ name: string | null }>
  | null;

type LotRel =
  | {
      lot_number: string;
      internal_lot_code: string;
      received_date: string | null;
      expiry_date: string | null;
      supplier: SupplierRel;
    }
  | Array<{
      lot_number: string;
      internal_lot_code: string;
      received_date: string | null;
      expiry_date: string | null;
      supplier: SupplierRel;
    }>
  | null;

type MaterialRel =
  | { id: string; name: string }
  | Array<{ id: string; name: string }>
  | null;

type RecipeRel =
  | { id: string; base_beef_weight: number | null }
  | Array<{ id: string; base_beef_weight: number | null }>
  | null;

interface BatchWithRecipe {
  id: string;
  recipe_id: string | null;
  beef_weight_kg: number;
  scaling_factor: number | null;
  recipe: RecipeRel;
}

interface RecipeIngredientRow {
  id: string;
  material_id: string;
  quantity: number;
  unit: Unit;
  is_critical: boolean | null;
  tolerance_percentage: number | null;
  display_order: number | null;
  is_cure: boolean | null;
  notes: string | null;
  material: MaterialRel;
}

interface UsageRow {
  id: string;
  material_id: string;
  quantity_used: number;
  unit: Unit;
  lot_id: string;
  lot: LotRel;
}

interface LotCheckRow {
  id: string;
  material_id: string;
  current_balance: number;
  material: { unit: Unit } | Array<{ unit: Unit }> | null;
}

/* =========
   GET
   ========= */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ batchId: string }> } // typed routes compat
) {
  const { batchId } = await context.params;
  const supabase = createClient();

  // 1) Batch + recipe basics
  const { data: batchRaw, error: bErr } = await supabase
    .from('batches')
    .select(
      `
      id,
      recipe_id,
      beef_weight_kg,
      scaling_factor,
      recipe:recipes (
        id,
        base_beef_weight
      )
    `
    )
    .eq('id', batchId)
    .single();

  if (bErr || !batchRaw) {
    return NextResponse.json({ error: bErr?.message ?? 'Batch not found' }, { status: 404 });
  }
  const batch = batchRaw as BatchWithRecipe;

  if (!batch.recipe_id) {
    // No recipe yet -> empty materials to render friendly message
    return NextResponse.json({ batch: { id: batch.id, recipe_id: null, scale: 1 }, materials: [] });
  }

  // Normalize potential array relation for recipe
  const recipeRel = batch.recipe;
  const recipeObj = Array.isArray(recipeRel) ? (recipeRel[0] ?? null) : recipeRel;
  const baseBeefG = Number(recipeObj?.base_beef_weight ?? 0);

  // 2) Recipe ingredients (targets)
  const { data: ingRaw, error: iErr } = await supabase
    .from('recipe_ingredients')
    .select(
      `
      id,
      material_id,
      quantity,
      unit,
      is_critical,
      tolerance_percentage,
      is_cure,
      display_order,
      notes,
      material:materials ( id, name )
    `
    )
    .eq('recipe_id', batch.recipe_id)
    .order('display_order', { ascending: true });

  if (iErr) {
    return NextResponse.json({ error: `recipe_ingredients: ${iErr.message}` }, { status: 400 });
  }
  const ingredients = (ingRaw ?? []) as RecipeIngredientRow[];

  // 3) Existing allocations for this batch
  const { data: useRaw, error: uErr } = await supabase
    .from('batch_lot_usage')
    .select(
      `
      id,
      material_id,
      quantity_used,
      unit,
      lot_id,
      lot:lots (
        lot_number,
        internal_lot_code,
        received_date,
        expiry_date,
        supplier:suppliers ( name )
      )
    `
    )
    .eq('batch_id', batchId);

  if (uErr) {
    return NextResponse.json({ error: `batch_lot_usage: ${uErr.message}` }, { status: 400 });
  }
  const usages = (useRaw ?? []) as UsageRow[];

  // 4) Scale factor (explicit takes precedence; else compute from beef/base)
  const explicitScale =
    typeof batch.scaling_factor === 'number' && Number.isFinite(batch.scaling_factor)
      ? batch.scaling_factor
      : null;
  const computedScale =
    baseBeefG > 0 ? ((Number(batch.beef_weight_kg) || 0) * 1000) / baseBeefG : 1;
  const scale = explicitScale && explicitScale > 0 ? explicitScale : computedScale;

  const cureSettings: CurePpmSettings = { ...DEFAULT_CURE_SETTINGS };
  try {
    const { data: settingsData, error: settingsError } = await supabase
      .from('project_settings')
      .select('key,value')
      .in('key', ['cure_ppm_min', 'cure_ppm_target', 'cure_ppm_max']);

    if (!settingsError && Array.isArray(settingsData)) {
      for (const row of settingsData) {
        const key = row?.key;
        const val = row?.value;
        if (typeof key === 'string' && typeof val === 'string') {
          const parsed = Number.parseFloat(val);
          if (Number.isFinite(parsed)) {
            if (key === 'cure_ppm_min') cureSettings.cure_ppm_min = parsed;
            if (key === 'cure_ppm_target') cureSettings.cure_ppm_target = parsed;
            if (key === 'cure_ppm_max') cureSettings.cure_ppm_max = parsed;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load cure settings; using defaults', err);
  }

  const weightUnits: ReadonlySet<Unit> = new Set(['g', 'kg']);
  let nonCureMassGrams = 0;
  for (const ri of ingredients) {
    const unit: Unit = ri.unit ?? 'g';
    if (!ri.is_cure && weightUnits.has(unit)) {
      const qty = Number(ri.quantity) * scale;
      nonCureMassGrams += convert(qty, unit, 'g');
    }
  }

  const batchBeefKg = Number(batch.beef_weight_kg) || 0;
  const baseMassForCure =
    nonCureMassGrams > 0
      ? nonCureMassGrams
      : batchBeefKg > 0
      ? batchBeefKg * 1000
      : baseBeefG > 0
      ? baseBeefG * scale
      : 0;

  // 5) Assemble materials (target / used / remaining + per-lot detail)
  const materials = ingredients.map((ri) => {
    const materialRel = ri.material;
    const materialObj = Array.isArray(materialRel) ? (materialRel[0] ?? null) : materialRel;

    const unit: Unit = ri.unit ?? 'g';

    const cureType = parseCureNote(ri.notes ?? null);
    let cureRequiredGrams: number | null = null;
    let target = Number(ri.quantity) * scale;

    if (ri.is_cure && cureType && baseMassForCure > 0) {
      cureRequiredGrams = calculateRequiredCureGrams(
        baseMassForCure,
        cureType,
        cureSettings.cure_ppm_target
      );
      target = convert(cureRequiredGrams, 'g', unit);
    }

    const rows = usages.filter((u) => u.material_id === ri.material_id);
    const used = rows.reduce((sum, u) => {
      const uv = Number(u.quantity_used) || 0;
      const uUnit: Unit = u.unit ?? unit;
      return sum + convert(uv, uUnit, unit);
    }, 0);

    const lots = rows.map((u) => {
      const lotRel = u.lot;
      const lotObj = Array.isArray(lotRel) ? (lotRel[0] ?? null) : lotRel;

      const supplierRel = lotObj?.supplier ?? null;
      const supplierObj = Array.isArray(supplierRel) ? (supplierRel[0] ?? null) : supplierRel;

      return {
        usage_id: u.id,
        lot_id: u.lot_id,
        lot_number: lotObj?.lot_number ?? '',
        internal_lot_code: lotObj?.internal_lot_code ?? '',
        quantity_used: Number(u.quantity_used) || 0,
        unit: (u.unit ?? unit) as Unit,
        supplier_name: supplierObj?.name ?? null,
        received_date: lotObj?.received_date ?? null,
        expiry_date: lotObj?.expiry_date ?? null,
      };
    });

    return {
      material_id: ri.material_id,
      material_name: materialObj?.name ?? 'Unknown',
      unit,
      target_amount: target,
      used_amount: used,
      remaining_amount: Math.max(0, target - used),
      is_critical: !!ri.is_critical,
      tolerance_percentage: Number(ri.tolerance_percentage ?? 5),
      is_cure: Boolean(ri.is_cure),
      cure_type: cureType,
      cure_nitrite_percent: cureType ? CURE_BY_ID[cureType].nitritePercent : null,
      cure_required_grams: cureRequiredGrams,
      cure_ppm_target: cureSettings.cure_ppm_target,
      cure_base_mass_grams: baseMassForCure,
      lots,
    };
  });

  return NextResponse.json({
    batch: { id: batch.id, recipe_id: batch.recipe_id, scale },
    materials,
    cure_settings: cureSettings,
    cure_mass_basis_grams: baseMassForCure,
    total_non_cure_mass_grams: nonCureMassGrams,
  });
}

/* =========
   POST (Allocate lots)
   ========= */
interface AllocationInput {
  lot_id: string;
  material_id: string;
  quantity_used: number; // in UI-selected (recipe row) unit
  unit: Unit;
}
interface PostBody {
  allocations: AllocationInput[];
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await context.params;
  const body = (await req.json()) as PostBody;

  if (!Array.isArray(body.allocations) || body.allocations.length === 0) {
    return NextResponse.json({ error: 'allocations is required' }, { status: 400 });
  }

  const supabase = createClient();

  // Process each allocation one-by-one (simple & clear)
  for (const a of body.allocations) {
    if (!a.lot_id || !a.material_id || !(Number(a.quantity_used) > 0) || !a.unit) {
      return NextResponse.json({ error: 'Invalid allocation row' }, { status: 400 });
    }

    // Load lot and its material unit (to validate balance)
    const { data: lotRaw, error: lErr } = await supabase
      .from('lots')
      .select(
        `
        id,
        material_id,
        current_balance,
        material:materials ( unit )
      `
      )
      .eq('id', a.lot_id)
      .single();

    if (lErr || !lotRaw) {
      return NextResponse.json({ error: lErr?.message ?? 'Lot not found' }, { status: 400 });
    }
    const lot = lotRaw as LotCheckRow;

    // Ensure lot belongs to same material
    if (lot.material_id !== a.material_id) {
      return NextResponse.json({ error: 'Lot does not match material' }, { status: 400 });
    }

    // Normalize lot's unit
    const matRel = lot.material;
    const matObj = Array.isArray(matRel) ? (matRel[0] ?? null) : matRel;
    const lotUnit: Unit = (matObj?.unit ?? 'g') as Unit;

    // Convert requested quantity to lot's unit to validate against balance
    const deltaInLotUnit = convert(Number(a.quantity_used), a.unit, lotUnit);
    if (deltaInLotUnit <= 0) {
      return NextResponse.json({ error: 'Quantity must be positive' }, { status: 400 });
    }
    if (deltaInLotUnit > lot.current_balance + 1e-9) {
      return NextResponse.json(
        { error: `Insufficient lot balance (available ${lot.current_balance} ${lotUnit})` },
        { status: 400 }
      );
    }

    // 1) Insert allocation (store the user's unit so UI displays consistently)
    const { error: iErr } = await supabase.from('batch_lot_usage').insert({
      batch_id: batchId,
      lot_id: a.lot_id,
      material_id: a.material_id,
      quantity_used: Number(a.quantity_used),
      unit: a.unit,
    });
    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 400 });
    }

    // 2) Decrement lot balance (simple optimistic update)
    const newBalance = Number(lot.current_balance) - deltaInLotUnit;
    const { error: uErr } = await supabase
      .from('lots')
      .update({ current_balance: newBalance })
      .eq('id', a.lot_id);
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

/* =========
   DELETE (Remove allocation)
   ========= */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await context.params;
  const usage_id = new URL(req.url).searchParams.get('usage_id');
  if (!usage_id) {
    return NextResponse.json({ error: 'usage_id is required' }, { status: 400 });
  }

  const supabase = createClient();

  // Load the usage + lot unit to restore balance
  const { data: uRaw, error: gErr } = await supabase
    .from('batch_lot_usage')
    .select(
      `
      id,
      batch_id,
      lot_id,
      material_id,
      quantity_used,
      unit,
      lot:lots (
        id,
        current_balance,
        material:materials ( unit )
      )
    `
    )
    .eq('id', usage_id)
    .eq('batch_id', batchId)
    .single();

  if (gErr || !uRaw) {
    return NextResponse.json({ error: gErr?.message ?? 'Allocation not found' }, { status: 404 });
  }

  // Normalize shapes
  const usage = uRaw as {
    id: string;
    batch_id: string;
    lot_id: string;
    material_id: string;
    quantity_used: number;
    unit: Unit;
    lot: {
      id: string;
      current_balance: number;
      material: { unit: Unit } | Array<{ unit: Unit }> | null;
    } | Array<{
      id: string;
      current_balance: number;
      material: { unit: Unit } | Array<{ unit: Unit }> | null;
    }> | null;
  };

  const lotRel = usage.lot;
  const lotObj = Array.isArray(lotRel) ? (lotRel[0] ?? null) : lotRel;
  if (!lotObj) {
    return NextResponse.json({ error: 'Linked lot not found' }, { status: 400 });
  }
  const matRel = lotObj.material;
  const matObj = Array.isArray(matRel) ? (matRel[0] ?? null) : matRel;
  const lotUnit: Unit = (matObj?.unit ?? 'g') as Unit;

  // Amount to restore in lot's unit
  const restore = convert(Number(usage.quantity_used), usage.unit, lotUnit);
  const newBalance = Number(lotObj.current_balance) + restore;

  // 1) Delete the usage
  const { error: dErr } = await supabase
    .from('batch_lot_usage')
    .delete()
    .eq('id', usage_id)
    .eq('batch_id', batchId);
  if (dErr) {
    return NextResponse.json({ error: dErr.message }, { status: 400 });
  }

  // 2) Restore lot balance
  const { error: uErr } = await supabase
    .from('lots')
    .update({ current_balance: newBalance })
    .eq('id', usage.lot_id);
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}


