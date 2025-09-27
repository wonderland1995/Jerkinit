// src/app/api/qa/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();

    const batch_id = String(form.get('batch_id') || '');
    const document_type_code = String(form.get('document_type_code') || '');
    const document_number = String(form.get('document_number') || '');
    const file_name = String(form.get('file_name') || '');
    const file_url = String(form.get('file_url') || '');
    const uploaded_by = (form.get('uploaded_by') as string) || null;
    const status = (form.get('status') as string) || 'pending';

    // Basic validation
    if (!batch_id || !document_type_code || !document_number || !file_name || !file_url) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Lookup document type
    const { data: docType, error: docTypeErr } = await supabase
      .from('qa_document_types')
      .select('id, code')
      .eq('code', document_type_code)
      .single();

    if (docTypeErr || !docType) {
      return NextResponse.json(
        { error: 'Document type not found', details: docTypeErr?.message },
        { status: 404 }
      );
    }

    // Insert document metadata
    const { data: inserted, error: insertErr } = await supabase
      .from('qa_documents')
      .insert({
        batch_id,
        document_type_id: docType.id, // ✅ TS now knows docType is non-null
        document_number,
        file_name,
        file_url,
        status,
        uploaded_by,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json(
        { error: 'Failed to save document', details: insertErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json(inserted, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: 'Unexpected error', details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
