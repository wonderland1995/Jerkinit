import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { getServerSession } from 'next-auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ComplianceLog } from '@/types/compliance';
import { authOptions } from '@/lib/auth/options';

const BUCKET = 'compliance-proof';

let bucketChecked = false;

async function ensureBucketExists() {
  if (bucketChecked) return;
  const { data, error } = await supabaseAdmin.storage.getBucket(BUCKET);
  if (data) {
    bucketChecked = true;
    return;
  }

  if (error && !/not found/i.test(error.message ?? '')) {
    console.warn('Unable to read compliance-proof bucket:', error.message ?? error);
    return;
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET, {
    public: true,
  });
  if (createError && !/already exists/i.test(createError.message ?? '')) {
    console.warn('Unable to create compliance-proof bucket:', createError.message ?? createError);
    return;
  }

  bucketChecked = true;
}

function buildPublicUrl(path: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    '';
  if (!baseUrl) return null;
  return `${baseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(Math.max(Number(limitParam), 1), 200) : 25;

  const { data, error } = await supabaseAdmin
    .from('compliance_logs')
    .select('*')
    .eq('compliance_task_id', taskId)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: (data ?? []) as ComplianceLog[] });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data payload' }, { status: 400 });
  }

  const taskId = form.get('task_id')?.toString() ?? '';
  if (!taskId) {
    return NextResponse.json({ error: 'task_id is required' }, { status: 400 });
  }

  const completedAtInput = form.get('completed_at')?.toString() ?? '';
  const completedAt = completedAtInput ? new Date(completedAtInput) : new Date();
  if (Number.isNaN(completedAt.getTime())) {
    return NextResponse.json({ error: 'completed_at is invalid' }, { status: 400 });
  }

  const completedBy = form.get('completed_by')?.toString().trim() || null;
  const notes = form.get('notes')?.toString().trim() || null;
  const result = form.get('result')?.toString().trim() || null;

  const metadata: Record<string, unknown> = {};
  const scope = form.get('scope')?.toString().trim();
  if (scope) metadata.scope = scope;

  const batchesCoveredRaw = form.get('batches_covered')?.toString();
  const batchesCovered = batchesCoveredRaw ? Number(batchesCoveredRaw) : null;
  if (Number.isFinite(batchesCovered)) {
    metadata.batches_covered = batchesCovered;
  }

  const batchStart = form.get('batch_start')?.toString().trim();
  const batchEnd = form.get('batch_end')?.toString().trim();
  if (batchStart || batchEnd) {
    metadata.batch_window = { start: batchStart ?? null, end: batchEnd ?? null };
  }

  const extraMetadataRaw = form.get('metadata')?.toString();
  if (extraMetadataRaw) {
    try {
      const parsed = JSON.parse(extraMetadataRaw);
      if (parsed && typeof parsed === 'object') {
        Object.assign(metadata, parsed);
      }
    } catch {
      // ignore invalid metadata JSON
    }
  }

  const file = form.get('proof') as File | null;
  let proofUrl: string | null = null;
  let proofFilename: string | null = null;

  if (file && file.size > 0) {
    const extension = file.name.includes('.') ? file.name.split('.').pop() : '';
    const safeExt = extension ? `.${extension.replace(/[^a-zA-Z0-9]/g, '')}` : '';
    const storageKey = `${taskId}/${randomUUID()}${safeExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await ensureBucketExists();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storageKey, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    proofUrl = buildPublicUrl(storageKey);
    proofFilename = file.name;
  }

  const { data, error } = await supabaseAdmin
    .from('compliance_logs')
    .insert({
      compliance_task_id: taskId,
      completed_at: completedAt.toISOString(),
      completed_by: completedBy,
      notes,
      result,
      proof_url: proofUrl,
      proof_filename: proofFilename,
      metadata,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ log: data as ComplianceLog });
}
