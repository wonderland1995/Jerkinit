// src/app/api/recipes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';
type IngredientInput = {
  material_id: string;
  quantity: number;
  unit: Unit;
  is_critical: boolean;
  notes: string | null;
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

export async function GET(_req: NextRequest) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('recipes')
    .select(
      'id, name, recipe_code, base_beef_weight, target_yield_weight, is_active, description, created_at'
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
  const ingredients = (Array.isArray(body.ingredients) ? body.ingredients : [])
    .filter(i => i.material_id && Number(i.quantity) > 0 && i.unit) as IngredientInput[];

  if (ingredients.length === 0) {
    return NextResponse.json({ error: 'At least one valid ingredient is required' }, { status: 400 });
  }

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
  const rows = ingredients.map((ing, idx) => ({
    recipe_id: recipe.id,
    material_id: ing.material_id,
    quantity: ing.quantity,
    unit: ing.unit,
    tolerance_percentage: 5.0,
    is_critical: !!ing.is_critical,
    is_cure: false,
    display_order: idx,
    notes: ing.notes ?? null,
  }));

  const { error: iErr } = await supabase.from('recipe_ingredients').insert(rows);
  if (iErr) {
    // cleanup recipe if ingredients failed
    await supabase.from('recipes').delete().eq('id', recipe.id);
    return NextResponse.json({ error: iErr.message }, { status: 400 });
  }

  return NextResponse.json({ id: recipe.id }, { status: 201 });
}
