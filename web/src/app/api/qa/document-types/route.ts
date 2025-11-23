// src/app/api/qa/document-types/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('qa_document_types')
    .select('id, code, name, description, required_for_batch, required_for_release, retention_days, active')
    .eq('active', true)
    .order('required_for_batch', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ document_types: data ?? [] });
}
