import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  // try to list products
  const { data, error } = await supabaseAdmin.from("products").select("*").limit(5);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ data }), { headers: { "content-type": "application/json" } });
}
