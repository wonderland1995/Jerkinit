import { NextResponse } from "next/server";
import { createClient } from "@/lib/db";

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, code")
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}
