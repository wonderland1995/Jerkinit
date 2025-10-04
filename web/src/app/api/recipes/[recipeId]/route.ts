import { NextResponse } from "next/server";
import { createClient } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { recipeId: string } }
) {
  const supabase = createClient();

  // recipe + its ingredients
  const { data, error } = await supabase
    .from("recipes")
    .select(`
      id, product_id, name, recipe_code, base_beef_weight, target_yield_weight,
      description, instructions, version, is_active, created_at, updated_at,
      recipe_ingredients (
        id, material_id, quantity, unit, tolerance_percentage, is_critical, is_cure, display_order, notes
      )
    `)
    .eq("id", params.recipeId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // You can also join materials if you want names:
  // recipe_ingredients ( id, quantity, unit, ..., material:materials ( id, name, material_code, unit ) )

  return NextResponse.json({ recipe: data });
}

// src/app/api/recipes/[recipeId]/route.ts
export async function PUT(req: Request, { params }: { params: { recipeId: string } }) {
  const supabase = createClient();
  const body = await req.json();

  const { error } = await supabase
    .from('recipes')
    .update({
      name: body.name,
      description: body.description ?? null,
      instructions: body.instructions ?? null,
      is_active: !!body.is_active,
    })
    .eq('id', params.recipeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
