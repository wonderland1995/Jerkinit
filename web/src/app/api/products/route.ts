import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, sku, name")
    .eq("active", true)
    .order("name");

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } });
}
