import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

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
      measured_at
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

  // 1) Load batch + recipe
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

  // batch has shape: { id, recipe_id, beef_weight_kg, scaling_factor, recipe: <unknown> }
const recipeJoin = pickRecipe((batch as { recipe?: unknown }).recipe);
if (!recipeJoin) {
  return NextResponse.json({ error: 'Recipe join not found' }, { status: 400 });
}

const baseBeefG = Number(recipeJoin.base_beef_weight ?? 0);

// prefer explicit scaling_factor if present; otherwise compute from beef_weight_kg (kg -> g)
const explicitScale =
  typeof batch.scaling_factor === 'number' && Number.isFinite(batch.scaling_factor)
    ? batch.scaling_factor
    : null;

const computedScale = baseBeefG > 0
  ? (Number(batch.beef_weight_kg) * 1000) / baseBeefG
  : 1;

const scale = explicitScale && explicitScale > 0 ? explicitScale : computedScale;


  // 2) Load recipe ingredient for this material
  const { data: ri, error: riErr } = await supabase
    .from('recipe_ingredients')
    .select(`
      quantity,
      unit,
      tolerance_percentage,
      material:materials ( id, name, unit )
    `)
    .eq('recipe_id', batch.recipe_id)
    .eq('material_id', materialId)
    .maybeSingle();

  if (riErr) {
    return NextResponse.json({ error: riErr.message }, { status: 400 });
  }
  if (!ri) {
    return NextResponse.json({ error: 'Material not part of the recipe' }, { status: 400 });
  }

  // Normalize relation shapes
  const materialRel = Array.isArray(ri.material) ? ri.material[0] : ri.material;
  const materialName = materialRel?.name ?? 'Unknown';
  const recipeUnit = toUnit((ri.unit as string) ?? 'g', 'g');
  const tolerance = body.tolerance_percentage ?? Number(ri.tolerance_percentage ?? 5);

  // 3) Compute target in the UI-provided unit
  const targetInRecipeUnit = Number(ri.quantity) * scale;
  const targetInUiUnit = convert(targetInRecipeUnit, recipeUnit, uiUnit);

  // 4) Compute in_tolerance
  const diffPct =
    targetInUiUnit > 0 ? (Math.abs(actual - targetInUiUnit) / targetInUiUnit) * 100 : 0;
  const inTol = diffPct <= tolerance;

  // 5) Upsert into batch_ingredients (update existing row or insert new)
  const { data: existing, error: exErr } = await supabase
    .from('batch_ingredients')
    .select('id')
    .eq('batch_id', batchId)
    .eq('material_id', materialId)
    .maybeSingle();

  if (exErr) {
    return NextResponse.json({ error: exErr.message }, { status: 400 });
  }

  if (existing?.id) {
    const { data: updated, error: uErr } = await supabase
      .from('batch_ingredients')
      .update({
        actual_amount: actual,
        unit: uiUnit,
        target_amount: targetInUiUnit,
        tolerance_percentage: tolerance,
        in_tolerance: inTol,
        measured_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
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
        measured_at
      `
      )
      .single();

    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 400 });
    }
    return NextResponse.json({ actual: updated });
  } else {
    const { data: inserted, error: iErr } = await supabase
      .from('batch_ingredients')
      .insert({
        batch_id: batchId,
        material_id: materialId,
        ingredient_name: materialName,
        target_amount: targetInUiUnit,
        actual_amount: actual,
        unit: uiUnit,
        tolerance_percentage: tolerance,
        in_tolerance: inTol,
        is_cure: false,
        measured_at: new Date().toISOString(),
      })
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
        measured_at
      `
      )
      .single();

    if (iErr) {
      return NextResponse.json({ error: iErr.message }, { status: 400 });
    }
    return NextResponse.json({ actual: inserted }, { status: 201 });
  }
}
