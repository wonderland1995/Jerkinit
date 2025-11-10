import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

  const { data, error } = await supabase
    .from('batches')
    .select(`
      *,
      product:products(
        id,
        name,
        code
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const normalized = (data ?? []).map((row) => {
    const { product, ...rest } = row as typeof row & {
      product?: { id: string; name: string | null; code: string | null } | null;
      product_name?: string | null;
    };
    return {
      ...rest,
      product_name: rest.product_name ?? product?.name ?? null,
      product_code: product?.code ?? null,
      product,
    };
  });

  return NextResponse.json({ batches: normalized });
}
