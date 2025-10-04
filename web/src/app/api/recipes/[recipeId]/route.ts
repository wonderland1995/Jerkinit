import { createClient } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
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
        product_category,
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
          is_critical,
          is_cure,
          material:materials (
            id,
            name,
            material_code
          )
        )
      `)
      .eq('id', recipeId)
      .single();

    if (error) throw error;

    // Transform recipe_ingredients to ingredients for frontend
    const transformed = {
      ...recipe,
      ingredients: recipe.recipe_ingredients || []
    };

    return NextResponse.json({ recipe: transformed });
  } catch (error) {
    console.error('Error fetching recipe:', error);
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
    const body = await req.json();
    
    const { data, error } = await supabase
      .from('recipes')
      .update({
        name: body.name,
        description: body.description,
        instructions: body.instructions,
        is_active: body.is_active,
      })
      .eq('id', recipeId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ recipe: data });
  } catch (error) {
    console.error('Error updating recipe:', error);
    return NextResponse.json({ error: 'Failed to update recipe' }, { status: 500 });
  }
}