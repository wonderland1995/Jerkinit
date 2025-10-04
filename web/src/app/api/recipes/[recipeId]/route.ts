import { createClient } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

type Params = { recipeId: string };
type Ctx = { params: Promise<Params> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, context: Ctx) {
  const { recipeId: slug } = await context.params;
  const byId = UUID_RE.test(slug);

  const supabase = createClient();

  const base = supabase
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
    .limit(1);

  const { data, error } = byId
    ? await base.eq('id', slug).single()
    : await base.eq('recipe_code', slug).single();

  if (error) {
    // PGRST116 = not found from PostgREST
    const status = error.code === 'PGRST116' ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  // keep your frontend contract: "ingredients" property
  return NextResponse.json({
    recipe: { ...data, ingredients: data.recipe_ingredients ?? [] },
  });
}

export async function PUT(req: NextRequest, context: Ctx) {
  const { recipeId } = await context.params;
  const supabase = createClient();

  type PutBody = {
    name?: string;
    description?: string | null;
    instructions?: string | null;
    is_active?: boolean;
  };

  try {
    const body = (await req.json()) as PutBody;

    const { data, error } = await supabase
      .from('recipes')
      .update({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
        ...(body.is_active !== undefined ? { is_active: !!body.is_active } : {}),
      })
      .eq('id', recipeId)
      .select()
      .single();

    if (error) {
      const status = error.code === 'PGRST116' ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ recipe: data });
  } catch (_err) {
    return NextResponse.json({ error: 'Failed to update recipe' }, { status: 500 });
  }
}
