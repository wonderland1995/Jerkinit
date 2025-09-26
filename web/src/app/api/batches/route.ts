import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  try {
    const { product_id, beef_kg } = await req.json();
    if (!product_id || !beef_kg) {
      return new Response(JSON.stringify({ error: "product_id and beef_kg required" }), { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc("create_batch_and_get_recipe", {
      p_product_id: product_id,
      p_beef_kg: beef_kg,
    });

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    const batch_id = data?.[0]?.batch_id ?? null;
    return new Response(JSON.stringify({ batch_id, lines: data ?? [] }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "unknown error" }), { status: 500 });
  }
}
