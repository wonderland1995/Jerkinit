import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, code, description, active')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data ?? [] });
}

export async function POST(request: NextRequest) {
  let body: { name?: string; code?: string; description?: string | null; active?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const name = body.name?.trim();
  const code = body.code?.trim().toUpperCase();
  const description = body.description?.trim() || null;
  const active = body.active ?? true;

  if (!name || !code) {
    return NextResponse.json({ error: 'Name and code are required.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('products')
    .insert({
      name,
      code,
      description,
      active,
    })
    .select('id, name, code, description, active')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data }, { status: 201 });
}
