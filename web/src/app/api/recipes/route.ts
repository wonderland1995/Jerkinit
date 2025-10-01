import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { CreateRecipeRequest, Recipe } from '@/types/inventory';

export async function GET() {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      ingredients:recipe_ingredients(
        *,
        material:materials(*)
      )
    `)
    .eq('is_active', true)
    .order('name');
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ recipes: data as Recipe[] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const body: CreateRecipeRequest = await request.json();
  
  // Insert recipe
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert({
      name: body.name,
      recipe_code: body.recipe_code,
      product_category: body.product_category,
      base_beef_weight: body.base_beef_weight,
      target_yield_weight: body.target_yield_weight,
      description: body.description,
      instructions: body.instructions,
    })
    .select()
    .single();
  
  if (recipeError) {
    return NextResponse.json({ error: recipeError.message }, { status: 400 });
  }
  
  // Insert ingredients
  const ingredientRecords = body.ingredients.map(ing => ({
    recipe_id: recipe.id,
    material_id: ing.material_id,
    quantity: ing.quantity,
    unit: ing.unit,
    is_critical: ing.is_critical,
    notes: ing.notes,
  }));
  
  const { error: ingredientsError } = await supabase
    .from('recipe_ingredients')
    .insert(ingredientRecords);
  
  if (ingredientsError) {
    return NextResponse.json({ error: ingredientsError.message }, { status: 500 });
  }
  
  return NextResponse.json({ recipe }, { status: 201 });
}