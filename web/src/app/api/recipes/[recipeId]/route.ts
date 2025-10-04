import { createClient } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

interface RecipeIngredient {
  id: string;
  material_id: string;
  quantity: number;
  unit: string;
  is_critical: boolean;
  is_cure: boolean;
  materials: {
    id: string;
    name: string;
    material_code: string;
  };
}

interface RecipeData {
  id: string;
  product_id: string;
  name: string;
  recipe_code: string;
  base_beef_weight: number;
  target_yield_weight: number | null;
  product_category: string | null;
  description: string | null;
  instructions: string | null;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  recipe_ingredients: RecipeIngredient[];
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ recipeId: string }> }
) {
  try {
    const { recipeId } = await context.params;
    console.log('[API] Fetching recipe:', recipeId);
    
    const supabase = createClient();

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
          materials (
            id,
            name,
            material_code
          )
        )
      `)
      .eq('id', recipeId)
      .single();

    if (error) {
      console.error('[API] Supabase error:', error);
      throw error;
    }

    if (!recipe) {
      console.log('[API] Recipe not found');
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    const recipeData = recipe as unknown as RecipeData;

    // Transform recipe_ingredients to ingredients for frontend
    const transformed = {
      ...recipeData,
      ingredients: (recipeData.recipe_ingredients || []).map((ri) => ({
        ...ri,
        material: ri.materials
      }))
    };

    console.log('[API] Returning recipe with', transformed.ingredients.length, 'ingredients');
    return NextResponse.json({ recipe: transformed });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch recipe';
    console.error('[API] Error fetching recipe:', error);
    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ recipeId: string }> }
) {
  try {
    const { recipeId } = await context.params;
    const supabase = createClient();
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to update recipe';
    console.error('[API] Error updating recipe:', error);
    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}