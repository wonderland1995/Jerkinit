import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db';

type Stage = 'preparation' | 'mixing' | 'marination' | 'drying' | 'packaging' | 'final';
type QAStatus = 'pending' | 'passed' | 'failed' | 'skipped' | 'conditional';

type QACheckpoint = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stage: Stage;
  required: boolean;
  display_order: number;
};

type QACheck = {
  id: string;
  checkpoint_id: string;
  status: QAStatus | null;
  metadata: Record<string, unknown> | null;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { batchId: string } }
) {
  const { batchId } = params;
  const supabase = createClient();

  // Get active checkpoints
  const { data: cps, error: cpsErr } = await supabase
    .from('qa_checkpoints')
    .select('id, code, name, description, stage, required, display_order')
    .eq('active', true)
    .order('stage', { ascending: true })
    .order('display_order', { ascending: true });

  if (cpsErr || !cps) {
    return NextResponse.json({ error: cpsErr?.message ?? 'Failed to load checkpoints' }, { status: 500 });
  }

  // Existing checks for this batch
  const { data: checks, error: chkErr } = await supabase
    .from('batch_qa_checks')
    .select('id, checkpoint_id, status, metadata')
    .eq('batch_id', batchId);

  if (chkErr || !checks) {
    return NextResponse.json({ error: chkErr?.message ?? 'Failed to load QA checks' }, { status: 500 });
  }

  const map = new Map<string, QACheck>();
  checks.forEach((c) => map.set(c.checkpoint_id, c));

  const merged = (cps as QACheckpoint[]).map((cp) => {
    const found = map.get(cp.id);
    return {
      ...cp,
      status: found?.status ?? 'pending',
      metadata: found?.metadata ?? null,
      check_id: found?.id ?? null,
    };
  });

  return NextResponse.json({ checkpoints: merged });
}
