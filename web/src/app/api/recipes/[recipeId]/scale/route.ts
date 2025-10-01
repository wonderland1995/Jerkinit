import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  const { recipeId } = await params;
  const supabase = createClient();
  const body = await request.json();
  const { beef_input_weight } = body;

  const { data: recipe, error } = await supabase
    .from('recipes')
    .select(`
      *,
      ingredients:recipe_ingredients(
        *,
        material:materials(*)
      )
    `)
    .eq('id', recipeId)
    .single();

  if (error || !recipe) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }

  const scaling_factor = beef_input_weight / recipe.base_beef_weight;

  const scaled_ingredients = recipe.ingredients.map((ing: { material: { id: string; name: string; material_code: string | null }; quantity: number; unit: string; is_critical: boolean | null; }) => ({
    material_id: ing.material_id,
    material_name: ing.material.name,
    material_code: ing.material.material_code,
    base_quantity: ing.quantity,
    scaled_quantity: ing.quantity * scaling_factor,
    unit: ing.unit,
    is_critical: ing.is_critical,
  }));

  return NextResponse.json({
    recipe_name: recipe.name,
    base_beef_weight: recipe.base_beef_weight,
    beef_input_weight,
    scaling_factor,
    scaled_ingredients,
  });
}