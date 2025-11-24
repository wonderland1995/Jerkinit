import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = request.nextUrl;
  const q = (searchParams.get('q') ?? '').trim();
  const limitParam = Number(searchParams.get('limit') ?? 20);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  let query = supabase
    .from('batches')
    .select(
      `
        id,
        batch_id,
        status,
        release_status,
        created_at,
        best_before_date,
        product:products(name)
      `,
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (q.length >= 2) {
    const escaped = q.replace(/[%_]/g, '');
    query = query.or(`batch_id.ilike.%${escaped}%,product.name.ilike.%${escaped}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const batches = (data ?? []).map((row) => {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    return {
      id: row.id,
      batch_id: row.batch_id,
      status: row.status,
      release_status: row.release_status,
      created_at: row.created_at,
      product_name: product?.name ?? null,
      best_before_date: (row as { best_before_date?: string | null }).best_before_date ?? null,
    };
  });

  return NextResponse.json({ batches });
}
