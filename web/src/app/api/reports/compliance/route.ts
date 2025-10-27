import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db';

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);

  const start = searchParams.get('start') ?? null;
  const end = searchParams.get('end') ?? null;
  const status = searchParams.get('status') ?? null;

  let query = supabase
    .from('batch_compliance_summary')
    .select(
      `
        batch_id,
        batch_number,
        product_name,
        batch_status,
        created_at,
        completed_at,
        total_ingredients,
        measured_ingredients,
        in_tolerance_count,
        tolerance_compliance_percent,
        required_checkpoints,
        passed_checkpoints,
        required_documents,
        approved_documents,
        release_status,
        release_number,
        approved_by,
        approved_at
      `
    )
    .order('created_at', { ascending: false });

  if (start) {
    query = query.gte('created_at', start);
  }

  if (end) {
    query = query.lte('created_at', end);
  }

  if (status && status !== 'all') {
    query = query.eq('batch_status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to load compliance data:', error);
    return NextResponse.json({ error: 'Unable to load compliance data' }, { status: 500 });
  }

  return NextResponse.json({ records: data ?? [] });
}
