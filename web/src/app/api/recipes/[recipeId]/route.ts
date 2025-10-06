// src/app/api/recipes/[recipeId]/route.ts
import { createClient } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

type PutIngredient = {
  material_id: string;
  quantity: number;
  unit: Unit;
  is_critical: boolean;
  notes: string | null;
};

type PutBody = {
  name?: string;
  description?: string | null;
  instructions?: string | null;
  is_active?: boolean;
  base_beef_weight?: number;        // grams
  target_yield_weight?: number | null;
  // If provided, we will REPLACE all existing ingredients with this list.
  ingredients?: PutIngredient[];
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { recipeId: string } }
) {
  const { recipeId } = params;
  const supabase = createClient();

  try {
    const { data: recipe, error } = await supabase
      .from('recipes')
      .select(`
        id,
        product_id,
        name,
        recipe_code,
        base_beef_weight,
        target_yield_weight,
        description,
        instructions,
        version,
        is_active,
        created_at,
        updated_at,
        recipe_ingredients (
          id,
          material_id,
          quantity,
          unit,
          tolerance_percentage,
          is_critical,
          is_cure,
          display_order,
          notes,
          material:materials (
            id,
            name,
            material_code,
            unit
          )
        )
      `)
      .eq('id', recipeId)
      .single();

    if (error) throw error;

    return NextResponse.json({ recipe });
  } catch (err) {
    console.error('Error fetching recipe:', err);
    return NextResponse.json({ error: 'Failed to fetch recipe' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { recipeId: string } }
) {
  const { recipeId } = params;
  const supabase = createClient();

  try {
    const body: PutBody = await req.json();

    // 1) Update recipe scalar fields (only those sent)
    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.description !== 'undefined') patch.description = body.description;
    if (typeof body.instructions !== 'undefined') patch.instructions = body.instructions;
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
    if (typeof body.base_beef_weight === 'number') patch.base_beef_weight = body.base_beef_weight; // grams
    if (typeof body.target_yield_weight !== 'undefined') patch.target_yield_weight = body.target_yield_weight;

    if (Object.keys(patch).length > 0) {
      const { error: rErr } = await supabase
        .from('recipes')
        .update(patch)
        .eq('id', recipeId);
      if (rErr) {
        return NextResponse.json({ error: rErr.message }, { status: 400 });
      }
    }

    // 2) Replace ingredients if provided
    if (Array.isArray(body.ingredients)) {
      // Validate each ingredient
      const clean = body.ingredients
        .map((ing, idx) => ({
          recipe_id: recipeId,
          material_id: ing.material_id,
          quantity: Number(ing.quantity),
          unit: ing.unit,
          tolerance_percentage: 5.0,
          is_critical: Boolean(ing.is_critical),
          is_cure: false,
          display_order: idx,
          notes: ing.notes ?? null,
        }))
        .filter(
          (row) =>
            !!row.material_id &&
            Number.isFinite(row.quantity) &&
            row.quantity > 0 &&
            !!row.unit
        );

      if (clean.length === 0) {
        return NextResponse.json(
          { error: 'A recipe must contain at least one ingredient.' },
          { status: 400 }
        );
      }

      // delete then insert (simple consistent replacement)
      const { error: delErr } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', recipeId);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 400 });
      }

      const { error: insErr } = await supabase
        .from('recipe_ingredients')
        .insert(clean);
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error updating recipe:', err);
    return NextResponse.json({ error: 'Failed to update recipe' }, { status: 500 });
  }
}
