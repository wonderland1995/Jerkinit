// web/src/app/api/batches/route.ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RecipeLine = {
  batch_id: string;
  line_no: number;
  ingredient_name: string;
  target_amount: number;
  uom: string;
  tolerance_pct: number;
  is_cure: boolean;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { product_id?: string; beef_kg?: number };
    const product_id = body.product_id;
    const beef_kg = body.beef_kg;

    if (!product_id || !beef_kg) {
      return new Response(JSON.stringify({ error: "product_id and beef_kg required" }), { status: 400 });
    }

    // ✅ Don't pass generics to rpc; just cast the data to RecipeLine[]
    const { data, error } = await supabaseAdmin.rpc(
      "create_batch_and_get_recipe",
      { p_product_id: product_id, p_beef_kg: beef_kg }
    );

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const lines = (data as RecipeLine[]) ?? [];
    const batch_id = lines.length ? lines[0].batch_id : null;

    return new Response(JSON.stringify({ batch_id, lines }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
}
