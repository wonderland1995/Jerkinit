// src/app/api/recipes/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/db";

type Body = {
  product_id: string;
  name: string;
  recipe_code: string;
  base_beef_weight: number;
  target_yield_weight: number | null;
  description?: string | null;
  instructions?: string | null;
  ingredients: Array<{
    material_id: string;
    quantity: number;
    unit: "g" | "kg" | "ml" | "L" | "units";
    is_critical: boolean;
    notes: string | null;
  }>;
};

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("recipes")
    .select("id, name, recipe_code, base_beef_weight, target_yield_weight, is_active, description, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // shape matches your RecipesPage expectation: { recipes: [...] }
  return NextResponse.json({ recipes: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = createClient();
  const body = (await req.json()) as Body;

  // Minimal guards (keep it simple)
  if (!body.product_id) return NextResponse.json({ error: "product_id is required" }, { status: 400 });
  if (!body.name || !body.recipe_code) return NextResponse.json({ error: "name and recipe_code are required" }, { status: 400 });
  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0)
    return NextResponse.json({ error: "At least one ingredient is required" }, { status: 400 });

  // 1) Insert recipe
  const { data: recipe, error: rErr } = await supabase
    .from("recipes")
    .insert({
      product_id: body.product_id,
      name: body.name,
      recipe_code: body.recipe_code,
      base_beef_weight: body.base_beef_weight,
      target_yield_weight: body.target_yield_weight,
      description: body.description ?? null,
      instructions: body.instructions ?? null,
    })
    .select("id")
    .single();

  if (rErr || !recipe) {
    return NextResponse.json({ error: rErr?.message ?? "Failed to create recipe" }, { status: 400 });
  }

  // 2) Insert ingredients
  const rows = body.ingredients.map((ing, idx) => ({
    recipe_id: recipe.id,
    material_id: ing.material_id,
    quantity: ing.quantity,
    unit: ing.unit,
    tolerance_percentage: 5.0, // default per your schema
    is_critical: !!ing.is_critical,
    is_cure: false,
    display_order: idx,
    notes: ing.notes ?? null,
  }));

  const { error: iErr } = await supabase.from("recipe_ingredients").insert(rows);
  if (iErr) {
    // optional cleanup to avoid orphaned recipe
    await supabase.from("recipes").delete().eq("id", recipe.id);
    return NextResponse.json({ error: iErr.message }, { status: 400 });
  }

  return NextResponse.json({ id: recipe.id }, { status: 201 });
}
