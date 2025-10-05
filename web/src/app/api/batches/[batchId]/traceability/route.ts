import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type Params = { batchId: string };
type Ctx = { params: Promise<Params> };

type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

// --- DB row shapes (minimal fields we read) ---
type BatchRow = {
  id: string;
  recipe_id: string | null;
  beef_weight_kg: number;
  scaling_factor: number | null;
};

type RecipeIngredientRow = {
  id: string;
  material_id: string;
  quantity: number;
  unit: Unit;
  tolerance_percentage: number | null;
  is_critical: boolean;
  is_cure: boolean;
  display_order: number | null;
  notes: string | null;
  material: { id: string; name: string; unit: Unit } | null;
};

type RecipeRow = {
  id: string;
  base_beef_weight: number;
  recipe_ingredients: RecipeIngredientRow[] | null;
};

type UsageRow = {
  id: string;
  batch_id: string;
  lot_id: string;
  material_id: string;
  quantity_used: number;
  unit: Unit;
  allocated_at: string;
  lot: {
    lot_number: string;
    internal_lot_code: string;
    received_date: string | null;
    expiry_date: string | null;
    supplier: { name: string | null } | null;
    material: { name: string; unit: Unit } | null;
  } | null;
};

// --- Response rows the UI will consume ---
type MaterialTraceRow = {
  material_id: string;
  material_name: string;
  unit: Unit;

  // From recipe (scaled target)
  target_amount: number;
  is_critical: boolean;
  tolerance_percentage: number;

  // From current allocations (sum of lot usage for this material)
  used_amount: number;
  remaining_amount: number;

  // Per-lot breakdown (what you've already allocated)
  lots: Array<{
    usage_id: string;
    lot_id: string;
    lot_number: string;
    internal_lot_code: string;
    quantity_used: number;
    unit: Unit;
    supplier_name: string | null;
    received_date: string | null;
    expiry_date: string | null;
  }>;
};

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { batchId } = await ctx.params;
  if (!isUUID(batchId)) {
    return NextResponse.json({ error: 'Invalid batch id' }, { status: 400 });
  }

  const supabase = createClient();

  // 1) Load batch (needs recipe and weight)
  const { data: batch, error: bErr } = await supabase
    .from('batches')
    .select('id, recipe_id, beef_weight_kg, scaling_factor')
    .eq('id', batchId)
    .single<BatchRow>();
  if (bErr || !batch) {
    return NextResponse.json({ error: bErr?.message ?? 'Batch not found' }, { status: 404 });
  }
  if (!batch.recipe_id) {
    return NextResponse.json({ error: 'Batch has no recipe_id' }, { status: 400 });
  }

  // 2) Load recipe + ingredients (+ material name/unit)
  const { data: recipe, error: rErr } = await supabase
    .from('recipes')
    .select(`
      id,
      base_beef_weight,
      recipe_ingredients (
        id, material_id, quantity, unit, tolerance_percentage, is_critical, is_cure, display_order, notes,
        material:materials ( id, name, unit )
      )
    `)
    .eq('id', batch.recipe_id)
    .single<RecipeRow>();
  if (rErr || !recipe) {
    return NextResponse.json({ error: rErr?.message ?? 'Recipe not found' }, { status: 404 });
  }

  // 3) Compute scale: kg -> grams / base_beef_weight, unless scaling_factor is set
  const base = Number(recipe.base_beef_weight) || 0;
  const batchGrams = (Number(batch.beef_weight_kg) || 0) * 1000;
  const explicitScale = typeof batch.scaling_factor === 'number' ? batch.scaling_factor : null;
  const scale = explicitScale && explicitScale > 0 ? explicitScale : base > 0 ? batchGrams / base : 1;

  // 4) Load existing lot allocations (traceability)
  const { data: usage, error: uErr } = await supabase
    .from('batch_lot_usage')
    .select(`
      id, batch_id, lot_id, material_id, quantity_used, unit, allocated_at,
      lot:lots (
        lot_number, internal_lot_code, received_date, expiry_date,
        supplier:suppliers ( name ),
        material:materials ( name, unit )
      )
    `)
    .eq('batch_id', batchId)
    .returns<UsageRow[]>();
  if (uErr) {
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  // 5) Build per-material trace rows from the recipe targets + current allocations
  const usageByMaterial = new Map<string, UsageRow[]>();
  (usage ?? []).forEach(row => {
    const arr = usageByMaterial.get(row.material_id) ?? [];
    arr.push(row);
    usageByMaterial.set(row.material_id, arr);
  });

  const rows: MaterialTraceRow[] = (recipe.recipe_ingredients ?? []).map((ri) => {
    const matName = ri.material?.name ?? 'Unknown';
    const unit: Unit = ri.unit ?? ri.material?.unit ?? 'g';
    const tol = typeof ri.tolerance_percentage === 'number' ? ri.tolerance_percentage : 5;
    const target = Number(ri.quantity) * scale;

    const usedRows = usageByMaterial.get(ri.material_id) ?? [];
    const used = usedRows.reduce((sum, r) => sum + (Number(r.quantity_used) || 0), 0);

    const lots = usedRows.map(r => ({
      usage_id: r.id,
      lot_id: r.lot_id,
      lot_number: r.lot?.lot_number ?? '',
      internal_lot_code: r.lot?.internal_lot_code ?? '',
      quantity_used: r.quantity_used,
      unit: r.unit,
      supplier_name: r.lot?.supplier?.name ?? null,
      received_date: r.lot?.received_date ?? null,
      expiry_date: r.lot?.expiry_date ?? null,
    }));

    return {
      material_id: ri.material_id,
      material_name: matName,
      unit,
      target_amount: target,
      is_critical: !!ri.is_critical,
      tolerance_percentage: tol,
      used_amount: used,
      remaining_amount: Math.max(0, target - used),
      lots,
    };
  });

  // (Optional) include allocations for materials NOT in the recipe (extras)
  const recipeMaterialIds = new Set((recipe.recipe_ingredients ?? []).map(r => r.material_id));
  const extraMaterials = [...usageByMaterial.keys()].filter(mid => !recipeMaterialIds.has(mid));
  const extraRows: MaterialTraceRow[] = extraMaterials.map(mid => {
    const usedRows = usageByMaterial.get(mid) ?? [];
    const used = usedRows.reduce((sum, r) => sum + (Number(r.quantity_used) || 0), 0);
    const first = usedRows[0];
    const matName = first?.lot?.material?.name ?? 'Unknown';
    const unit = first?.unit ?? 'g';

    return {
      material_id: mid,
      material_name: matName,
      unit: unit as Unit,
      target_amount: 0,
      is_critical: false,
      tolerance_percentage: 0,
      used_amount: used,
      remaining_amount: 0,
      lots: usedRows.map(r => ({
        usage_id: r.id,
        lot_id: r.lot_id,
        lot_number: r.lot?.lot_number ?? '',
        internal_lot_code: r.lot?.internal_lot_code ?? '',
        quantity_used: r.quantity_used,
        unit: r.unit,
        supplier_name: r.lot?.supplier?.name ?? null,
        received_date: r.lot?.received_date ?? null,
        expiry_date: r.lot?.expiry_date ?? null,
      })),
    };
  });

  return NextResponse.json({
    batch: { id: batch.id, recipe_id: batch.recipe_id, scale },
    materials: [...rows, ...extraRows],
  });
}

// Optional: allow adding allocations via this endpoint too.
// Body: { allocations: [{ lot_id, material_id, quantity_used, unit }] }
type PostBody = {
  allocations: Array<{
    lot_id: string;
    material_id: string;
    quantity_used: number;
    unit: Unit;
  }>;
};

export async function POST(req: NextRequest, ctx: Ctx) {
  const { batchId } = await ctx.params;
  if (!isUUID(batchId)) {
    return NextResponse.json({ error: 'Invalid batch id' }, { status: 400 });
  }

  const body = (await req.json()) as PostBody;
  const allocations = (Array.isArray(body.allocations) ? body.allocations : [])
    .filter(a => a.lot_id && a.material_id && typeof a.quantity_used === 'number' && a.quantity_used > 0);

  if (allocations.length === 0) {
    return NextResponse.json({ error: 'No valid allocations' }, { status: 400 });
  }
  const supabase = createClient();

  const rows = allocations.map(a => ({
    batch_id: batchId,
    lot_id: a.lot_id,
    material_id: a.material_id,
    quantity_used: a.quantity_used,
    unit: a.unit,
  }));



  const { error } = await supabase.from('batch_lot_usage').insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const usage_id = searchParams.get('usage_id');

  if (!usage_id) {
    return NextResponse.json({ error: 'usage_id is required' }, { status: 400 });
  }

  const supabase = createClient();
  // only delete from this batch
  const { error } = await supabase
    .from('batch_lot_usage')
    .delete()
    .eq('id', usage_id)
    .eq('batch_id', batchId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}