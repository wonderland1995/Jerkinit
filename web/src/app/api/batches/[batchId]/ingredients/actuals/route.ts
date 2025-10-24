import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import {
  DEFAULT_CURE_SETTINGS,
  calculatePpm,
  calculateRequiredCureGrams,
  evaluateCureStatus,
  parseCureNote,
  type CurePpmSettings,
  type CureStatus,
  type CureType,
} from '@/lib/cure';

type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  if (from === 'kg' && to === 'g') return value * 1000;
  if (from === 'g' && to === 'kg') return value / 1000;
  if (from === 'L' && to === 'ml') return value * 1000;
  if (from === 'ml' && to === 'L') return value / 1000;
  return value;
}

const validUnits: ReadonlySet<Unit> = new Set(['g', 'kg', 'ml', 'L', 'units']);
const toUnit = (x: unknown, fallback: Unit): Unit =>
  typeof x === 'string' && validUnits.has(x as Unit) ? (x as Unit) : fallback;

type RecipeJoin = { id: string; base_beef_weight: number };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function pickRecipe(obj: unknown): RecipeJoin | null {
  // handle array shape
  if (Array.isArray(obj)) {
    const first = obj[0];
    if (isRecord(first)) {
      const id = typeof first.id === 'string' ? first.id : '';
      const bbwRaw = (first as Record<string, unknown>).base_beef_weight;
      const bbw =
        typeof bbwRaw === 'number' ? bbwRaw : Number(bbwRaw ?? 0);
      return { id, base_beef_weight: bbw };
    }
    return null;
  }
  // handle object shape
  if (isRecord(obj)) {
    const id = typeof obj.id === 'string' ? obj.id : '';
    const bbwRaw = (obj as Record<string, unknown>).base_beef_weight;
    const bbw =
      typeof bbwRaw === 'number' ? bbwRaw : Number(bbwRaw ?? 0);
    return { id, base_beef_weight: bbw };
  }
  return null;
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
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await ctx.params;
  const supabase = createClient();

  const { data, error } = await supabase
    .from('batch_ingredients')
    .select(
      `
      id,
      material_id,
      ingredient_name,
      target_amount,
      actual_amount,
      unit,
      tolerance_percentage,
      in_tolerance,
      measured_at,
      is_cure,
      cure_required_grams,
      cure_ppm,
      cure_status,
      cure_unit
    `
    )
    .eq('batch_id', batchId)
    .order('ingredient_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    actuals: (data ?? []) as ActualRow[],
  });
}

interface PostBody {
  material_id: string;
  actual_amount: number;
  unit: Unit;
  tolerance_percentage?: number; // optional override, defaults to recipe's value or 5
  recorded_by?: string | null;
}


export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await ctx.params;
  const supabase = createClient();

  const body = (await req.json()) as PostBody;
  const materialId = body.material_id;
  const actual = Number(body.actual_amount);
  const uiUnit = toUnit(body.unit, 'g');

  if (!materialId || !(actual > 0)) {
    return NextResponse.json({ error: 'material_id and positive actual_amount are required' }, { status: 400 });
  }

  const { data: batch, error: bErr } = await supabase
    .from('batches')
    .select(
      `
      id,
      recipe_id,
      beef_weight_kg,
      scaling_factor,
      recipe:recipes ( id, base_beef_weight )
    `
    )
    .eq('id', batchId)
    .single();

  if (bErr || !batch) {
    return NextResponse.json({ error: bErr?.message ?? 'Batch not found' }, { status: 404 });
  }
  if (!batch.recipe_id) {
    return NextResponse.json({ error: 'Batch has no recipe' }, { status: 400 });
  }

  const recipeJoin = pickRecipe((batch as { recipe?: unknown }).recipe);
  if (!recipeJoin) {
    return NextResponse.json({ error: 'Recipe join not found' }, { status: 400 });
  }

  const baseBeefG = Number(recipeJoin.base_beef_weight ?? 0);

  const explicitScale =
    typeof batch.scaling_factor === 'number' && Number.isFinite(batch.scaling_factor)
      ? batch.scaling_factor
      : null;

  const computedScale =
    baseBeefG > 0
      ? ((Number(batch.beef_weight_kg) || 0) * 1000) / baseBeefG
      : 1;

  const scale = explicitScale && explicitScale > 0 ? explicitScale : computedScale;
  const batchBeefKg = Number(batch.beef_weight_kg) || 0;

  const { data: ingredientsRaw, error: ingErr } = await supabase
    .from('recipe_ingredients')
    .select(`
      material_id,
      quantity,
      unit,
      tolerance_percentage,
      is_cure,
      notes,
      material:materials ( id, name, unit )
    `)
    .eq('recipe_id', batch.recipe_id);

  if (ingErr) {
    return NextResponse.json({ error: ingErr.message }, { status: 400 });
  }
  const ingredients = (ingredientsRaw ?? []) as RecipeIngredientRow[];
  const ri = ingredients.find((row) => row.material_id === materialId);

  if (!ri) {
    return NextResponse.json({ error: 'Material not part of the recipe' }, { status: 400 });
  }

  const materialRel = Array.isArray(ri.material) ? ri.material[0] : ri.material;
  const materialName = materialRel?.name ?? 'Unknown';
  const recipeUnit = toUnit((ri.unit as string) ?? 'g', 'g');
  const tolerance = body.tolerance_percentage ?? Number(ri.tolerance_percentage ?? 5);
  const isCure = Boolean(ri.is_cure);
  const cureType = parseCureNote(ri.notes ?? null);

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
    console.warn('Failed to load cure settings in actuals route; using defaults', err);
  }

  const weightUnits: ReadonlySet<Unit> = new Set(['g', 'kg']);
  let nonCureMassGrams = 0;
  for (const ing of ingredients) {
    const ingUnit: Unit = toUnit((ing.unit as string) ?? 'g', 'g');
    if (!ing.is_cure && weightUnits.has(ingUnit)) {
      const scaledQty = Number(ing.quantity) * scale;
      nonCureMassGrams += convert(scaledQty, ingUnit, 'g');
    }
  }

  const baseMassForCure =
    nonCureMassGrams > 0
      ? nonCureMassGrams
      : batchBeefKg > 0
      ? batchBeefKg * 1000
      : baseBeefG > 0
      ? baseBeefG * scale
      : 0;

  let cureRequiredGrams: number | null = null;
  let targetInRecipeUnit: number;

  if (isCure && cureType && baseMassForCure > 0) {
    cureRequiredGrams = calculateRequiredCureGrams(
      baseMassForCure,
      cureType,
      cureSettings.cure_ppm_target
    );
    targetInRecipeUnit = convert(cureRequiredGrams, 'g', recipeUnit);
  } else {
    targetInRecipeUnit = Number(ri.quantity) * scale;
  }

  const targetInUiUnit = convert(targetInRecipeUnit, recipeUnit, uiUnit);

  const diffPct =
    targetInUiUnit > 0 ? (Math.abs(actual - targetInUiUnit) / targetInUiUnit) * 100 : 0;
  const inTol = diffPct <= tolerance;

  const actualInRecipeUnit = convert(actual, uiUnit, recipeUnit);
  const actualInGrams = convert(actualInRecipeUnit, recipeUnit, 'g');
  const totalMassForActual = baseMassForCure + actualInGrams;
  const curePpm =
    isCure && cureType && actualInGrams > 0 && totalMassForActual > 0
      ? calculatePpm(actualInGrams, totalMassForActual, cureType)
      : null;
  const cureStatus =
    isCure && curePpm != null ? evaluateCureStatus(curePpm, cureSettings) : null;

  const measuredAt = new Date().toISOString();

  const { data: existing, error: exErr } = await supabase
    .from('batch_ingredients')
    .select('id')
    .eq('batch_id', batchId)
    .eq('material_id', materialId)
    .maybeSingle();

  if (exErr) {
    return NextResponse.json({ error: exErr.message }, { status: 400 });
  }

  const measurementPayload = {
    actual_amount: actual,
    unit: uiUnit,
    target_amount: targetInUiUnit,
    tolerance_percentage: tolerance,
    in_tolerance: inTol,
    measured_at: measuredAt,
    is_cure: isCure,
    cure_required_grams: cureRequiredGrams,
    cure_ppm: curePpm,
    cure_status: cureStatus,
    cure_unit: isCure ? recipeUnit : null,
  };

  let dbRow: ActualRow | null = null;
  let statusCode = 200;

  if (existing?.id) {
    const { data: updated, error: uErr } = await supabase
      .from('batch_ingredients')
      .update(measurementPayload)
      .eq('id', existing.id)
      .select(`
        id,
        material_id,
        ingredient_name,
        target_amount,
        actual_amount,
        unit,
        tolerance_percentage,
        in_tolerance,
        measured_at,
        is_cure,
        cure_required_grams,
        cure_ppm,
        cure_status,
        cure_unit
      `)
      .single();

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 400 });
    }
    dbRow = updated as ActualRow;
  } else {
    const insertPayload = {
      batch_id: batchId,
      material_id: materialId,
      ingredient_name: materialName,
      ...measurementPayload,
    };

    const { data: inserted, error: iErr } = await supabase
      .from('batch_ingredients')
      .insert(insertPayload)
      .select(`
        id,
        material_id,
        ingredient_name,
        target_amount,
        actual_amount,
        unit,
        tolerance_percentage,
        in_tolerance,
        measured_at,
        is_cure,
        cure_required_grams,
        cure_ppm,
        cure_status,
        cure_unit
      `)
      .single();

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 400 });
    }
    dbRow = inserted as ActualRow;
    statusCode = 201;
  }

  if (!dbRow) {
    return NextResponse.json({ error: 'Failed to persist actual' }, { status: 500 });
  }

  const enriched: ActualRow = {
    ...dbRow,
    is_cure: isCure,
    cure_type: cureType,
    cure_required_grams: isCure
      ? cureRequiredGrams ?? dbRow.cure_required_grams ?? null
      : dbRow.cure_required_grams ?? null,
    cure_ppm: isCure ? curePpm ?? dbRow.cure_ppm ?? null : dbRow.cure_ppm ?? null,
    cure_status: isCure
      ? cureStatus ?? dbRow.cure_status ?? null
      : dbRow.cure_status ?? null,
    cure_unit: isCure ? recipeUnit : dbRow.cure_unit ?? null,
    cure_base_mass_grams: baseMassForCure,
  };

  if (isCure) {
    const { error: auditErr } = await supabase
      .from('batch_cure_audit')
      .insert({
        batch_id: batchId,
        material_id: materialId,
        actual_amount: actual,
        unit: uiUnit,
        cure_ppm: curePpm,
        cure_status: cureStatus,
        recorded_by: body.recorded_by ?? null,
        metadata: {
          target_grams: cureRequiredGrams,
          target_unit: recipeUnit,
          target_ppm: cureSettings.cure_ppm_target,
          base_mass_grams: baseMassForCure,
          tolerance_percentage: tolerance,
        },
      });
    if (auditErr) {
      console.warn('Failed to log cure audit', auditErr);
    }
  }

  return NextResponse.json({ actual: enriched }, { status: statusCode });
}
