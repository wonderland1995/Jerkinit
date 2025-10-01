import { createClient } from '@/lib/db';
import { NextResponse } from 'next/server';
import type { Supplier } from '@/types/inventory';

export async function GET() {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name');
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json({ suppliers: data as Supplier[] });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const body = await request.json();
  
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      name: body.name,
      supplier_code: body.supplier_code,
      contact_email: body.contact_email,
      contact_phone: body.contact_phone,
      address: body.address,
      certification_status: body.certification_status || 'pending',
      notes: body.notes,
    })
    .select()
    .single();
  
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  
  return NextResponse.json({ supplier: data }, { status: 201 });
}