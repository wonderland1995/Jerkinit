import { createClient } from '@/lib/db';
import { parseCureNote, encodeCureNote } from '@/lib/cure';
import type { CureType } from '@/lib/cure';
import { NextRequest, NextResponse } from 'next/server';

type Unit = 'g' | 'kg' | 'ml' | 'L' | 'units';

type PutIngredient = {
  material_id: string;
  quantity: number;
  unit: Unit;
  is_critical: boolean;
  notes: string | null;
  is_cure?: boolean;
  cure_type?: CureType | null;
};

type PutBody = {
  name?: string;
  description?: string | null;
  instructions?: string | null;
  is_active?: boolean;
  base_beef_weight?: number;        // grams
  target_yield_weight?: number | null;
  ingredients?: PutIngredient[];    // replace all if provided
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ recipeId: string }> }
) {
  const { recipeId } = await context.params;
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

    const normalized =
      recipe?.recipe_ingredients?.map((row) => ({
        ...row,
        cure_type: parseCureNote(row.notes ?? null),
      })) ?? null;

    return NextResponse.json(
      recipe
        ? {
            recipe: {
              ...recipe,
              recipe_ingredients: normalized,
            },
          }
        : { recipe: null }
    );
  } catch (err) {
    console.error('Error fetching recipe:', err);
    return NextResponse.json({ error: 'Failed to fetch recipe' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ recipeId: string }> }
) {
  const { recipeId } = await context.params;
  const supabase = createClient();

  try {
    const body: PutBody = await req.json();

    // 1) update scalars if provided
    const patch: Record<string, unknown> = {};
    if (typeof body.name === 'string') patch.name = body.name;
    if (typeof body.description !== 'undefined') patch.description = body.description;
    if (typeof body.instructions !== 'undefined') patch.instructions = body.instructions;
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
    if (typeof body.base_beef_weight === 'number') patch.base_beef_weight = body.base_beef_weight;
    if (typeof body.target_yield_weight !== 'undefined') patch.target_yield_weight = body.target_yield_weight;

    if (Object.keys(patch).length > 0) {
      const { error: rErr } = await supabase.from('recipes').update(patch).eq('id', recipeId);
      if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 });
    }

    // 2) replace ingredients if provided
    if (Array.isArray(body.ingredients)) {
      const mapped = body.ingredients.map((ing, idx) => ({
        recipe_id: recipeId,
        material_id: ing.material_id,
        quantity: Number(ing.quantity),
        unit: ing.unit,
        tolerance_percentage: 5.0,
        is_critical: Boolean(ing.is_critical),
        is_cure: Boolean(ing.is_cure),
        cure_type: ing.cure_type ?? null,
        display_order: idx,
        notes: ing.is_cure ? encodeCureNote(ing.cure_type ?? null) : ing.notes ?? null,
      }));

      const cureCount = mapped.filter((row) => row.is_cure).length;
      if (cureCount > 1) {
        return NextResponse.json(
          { error: 'Only one cure ingredient can be defined per recipe.' },
          { status: 400 }
        );
      }

      if (mapped.some((row) => row.is_cure && !row.cure_type)) {
        return NextResponse.json(
          { error: 'Cure ingredients must specify a cure_type.' },
          { status: 400 }
        );
      }

      const clean = mapped.filter(
        (row) => row.material_id && row.unit && (row.is_cure || row.quantity > 0)
      );

      if (clean.length === 0) {
        return NextResponse.json(
          { error: 'A recipe must contain at least one ingredient.' },
          { status: 400 }
        );
      }

      const { error: delErr } = await supabase
        .from('recipe_ingredients')
        .delete()
        .eq('recipe_id', recipeId);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

      const rows = clean.map((row) => ({
        recipe_id: row.recipe_id,
        material_id: row.material_id,
        quantity: row.quantity,
        unit: row.unit,
        tolerance_percentage: row.tolerance_percentage,
        is_critical: row.is_critical,
        is_cure: row.is_cure,
        display_order: row.display_order,
        notes: row.is_cure ? encodeCureNote(row.cure_type ?? null) : row.notes ?? null,
      }));

      const { error: insErr } = await supabase.from('recipe_ingredients').insert(rows);
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error updating recipe:', err);
    return NextResponse.json({ error: 'Failed to update recipe' }, { status: 500 });
  }
}



