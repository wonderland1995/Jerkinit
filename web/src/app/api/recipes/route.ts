// src/app/api/recipes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { encodeCureNote } from '@/lib/cure';
import type { CureType } from '@/lib/cure';

type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';
type IngredientInput = {
  material_id: string;
  quantity: number;
  unit: Unit;
  is_critical: boolean;
  notes: string | null;
  is_cure?: boolean;
  cure_type?: CureType | null;
};
type PostBody = {
  product_id?: string;
  name: string;
  recipe_code: string;
  base_beef_weight: number;
  target_yield_weight: number | null;
  description?: string | null;
  instructions?: string | null;
  ingredients: IngredientInput[];
};

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('recipes')
    .select(
      `
        id,
        product_id,
        name,
        recipe_code,
        base_beef_weight,
        target_yield_weight,
        is_active,
        description,
        created_at,
        product:products (
          id,
          name,
          code
        )
      `
    )
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ recipes: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const body = (await req.json()) as PostBody;

  // validate basic fields
  if (!body.name || !body.recipe_code) {
    return NextResponse.json({ error: 'name and recipe_code are required' }, { status: 400 });
  }

  // validate ingredients (must be at least one valid row)
  const rawIngredients = Array.isArray(body.ingredients) ? body.ingredients : [];
  const ingredients = rawIngredients
    .filter((i) => i.material_id && Number.isFinite(Number(i.quantity)) && i.unit)
    .map((i) => ({
      ...i,
      quantity: Number(i.quantity),
    })) as IngredientInput[];

  if (ingredients.length === 0) {
    return NextResponse.json({ error: 'At least one valid ingredient is required' }, { status: 400 });
  }

  const cureCount = ingredients.filter((ing) => ing.is_cure).length;
  if (cureCount > 1) {
    return NextResponse.json({ error: 'Only one cure ingredient can be defined per recipe.' }, { status: 400 });
  }
  if (ingredients.some((ing) => ing.is_cure && !ing.cure_type)) {
    return NextResponse.json({ error: 'Cure ingredients must specify a cure_type.' }, { status: 400 });
  }

  const normalizedIngredients = ingredients.map((ing, idx) => ({
    recipe_id: '',
    material_id: ing.material_id,
    quantity: ing.quantity,
    unit: ing.unit,
    tolerance_percentage: 5.0,
    is_critical: Boolean(ing.is_critical),
    is_cure: Boolean(ing.is_cure),
    cure_type: ing.cure_type ?? null,
    display_order: idx,
    notes: ing.notes ?? null,
  }));

  // optional: auto-create/reuse product if not provided
  let productId = body.product_id;
  if (!productId) {
    const { data: productRow, error: pErr } = await supabase
      .from('products')
      .upsert(
        {
          code: body.recipe_code,
          name: body.name,
          description: body.description ?? null,
          active: true,
        },
        { onConflict: 'code' }
      )
      .select('id')
      .single();
    if (pErr || !productRow) {
      return NextResponse.json({ error: pErr?.message ?? 'Failed to upsert product' }, { status: 400 });
    }
    productId = productRow.id;
  }

  // 1) Insert recipe
  const { data: recipe, error: rErr } = await supabase
    .from('recipes')
    .insert({
      product_id: productId,
      name: body.name,
      recipe_code: body.recipe_code,
      base_beef_weight: body.base_beef_weight,
      target_yield_weight: body.target_yield_weight,
      description: body.description ?? null,
      instructions: body.instructions ?? null,
      is_active: true,
    })
    .select('id')
    .single();

  if (rErr || !recipe) {
    return NextResponse.json({ error: rErr?.message ?? 'Failed to create recipe' }, { status: 400 });
  }

  // 2) Insert ingredients
  const rows = normalizedIngredients.map((ing) => ({
    recipe_id: recipe.id,
    material_id: ing.material_id,
    quantity: ing.quantity,
    unit: ing.unit,
    tolerance_percentage: 5.0,
    is_critical: ing.is_critical,
    is_cure: ing.is_cure,
    display_order: ing.display_order,
    notes: ing.is_cure ? encodeCureNote(ing.cure_type ?? null) : ing.notes ?? null,
  }));

  const hasMeasurable = normalizedIngredients.some((ing) => ing.is_cure || ing.quantity > 0);
  if (!hasMeasurable) {
    return NextResponse.json(
      { error: 'At least one ingredient must have a quantity greater than 0.' },
      { status: 400 }
    );
  }

  const { error: iErr } = await supabase.from('recipe_ingredients').insert(rows);
  if (iErr) {
    // cleanup recipe if ingredients failed
    await supabase.from('recipes').delete().eq('id', recipe.id);
    return NextResponse.json({ error: iErr.message }, { status: 400 });
  }

  return NextResponse.json({ id: recipe.id }, { status: 201 });
}
