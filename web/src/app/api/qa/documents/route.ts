// src/app/api/qa/documents/route.ts
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const BUCKET = 'qa-documents';

function buildPublicUrl(path: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    '';
  if (!baseUrl) return null;
  return `${baseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get('batchId') ?? searchParams.get('batch_id');

  if (!batchId) {
    return NextResponse.json({ error: 'batchId is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('qa_documents')
    .select(
      `
        *,
        document_type:qa_document_types (
          id,
          code,
          name
        )
      `
    )
    .eq('batch_id', batchId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data payload' }, { status: 400 });
  }

  const batch_id = formData.get('batch_id')?.toString().trim() ?? '';
  const document_type_code = formData.get('document_type_code')?.toString().trim() || 'QA-PHOTO';
  const document_number =
    formData.get('document_number')?.toString().trim() ||
    `${document_type_code}-${Date.now()}`;
  const uploaded_by = formData.get('uploaded_by')?.toString().trim() || null;
  const status = formData.get('status')?.toString().trim() || 'pending';
  const notes = formData.get('notes')?.toString().trim() || null;

  if (!batch_id || !document_type_code) {
    return NextResponse.json(
      { error: 'batch_id and document_type_code are required' },
      { status: 400 }
    );
  }

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Upload file is required' }, { status: 400 });
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop() ?? '' : '';
  const sanitizedExt = ext.replace(/[^a-zA-Z0-9]/g, '');
  const storageKey = `${batch_id}/${randomUUID()}${sanitizedExt ? `.${sanitizedExt}` : ''}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storageKey, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const file_url = buildPublicUrl(storageKey);
  if (!file_url) {
    return NextResponse.json({ error: 'Unable to resolve public file URL' }, { status: 500 });
  }

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

  const metadata = {
    storage_path: storageKey,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('qa_documents')
    .insert({
      batch_id,
      document_type_id: docType.id,
      document_number,
      file_name: file.name,
      file_url,
      status,
      uploaded_by,
      notes,
      metadata,
    })
    .select(
      `
        *,
        document_type:qa_document_types (
          id,
          code,
          name
        )
      `
    )
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: 'Failed to save document', details: insertErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json(inserted, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('id');

  if (!documentId) {
    return NextResponse.json({ error: 'Document id is required' }, { status: 400 });
  }

  const { data: existing, error: fetchErr } = await supabase
    .from('qa_documents')
    .select('id, metadata, file_url')
    .eq('id', documentId)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: fetchErr?.message ?? 'Document not found' }, { status: 404 });
  }

  const storagePath =
    existing.metadata && typeof existing.metadata === 'object'
      ? (existing.metadata as { storage_path?: string | null }).storage_path ?? null
      : null;

  if (storagePath) {
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
  } else if (existing.file_url) {
    const url = new URL(existing.file_url);
    const parts = url.pathname.split(`/storage/v1/object/public/${BUCKET}/`);
    if (parts.length === 2 && parts[1]) {
      await supabaseAdmin.storage.from(BUCKET).remove([parts[1]]);
    }
  }

  const { error: deleteErr } = await supabase.from('qa_documents').delete().eq('id', documentId);
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
