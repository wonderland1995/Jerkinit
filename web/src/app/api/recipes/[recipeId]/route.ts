// src/app/api/recipes/[recipeId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type Params = { recipeId: string };
type Ctx = { params: Promise<Params> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { recipeId: slug } = await ctx.params;
  const byId = UUID_RE.test(slug);

  const supabase = createClient();
  const base = supabase
    .from('recipes')
    .select(`
      id, product_id, name, recipe_code, base_beef_weight, target_yield_weight,
      description, instructions, version, is_active, created_at, updated_at,
      recipe_ingredients (
        id, material_id, quantity, unit, tolerance_percentage,
        is_critical, is_cure, display_order, notes,
        material:materials ( id, name, material_code, unit )
      )
    `)
    .limit(1);

  const query = byId ? base.eq('id', slug) : base.eq('recipe_code', slug);
  const { data, error } = await query.single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return NextResponse.json({ recipe: data });
}
