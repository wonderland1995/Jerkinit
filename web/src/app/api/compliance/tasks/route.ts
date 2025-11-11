import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import type { ComplianceTask, ComplianceTaskWithStatus } from '@/types/compliance';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const INTERVAL_LOOKUP: Record<ComplianceTask['frequency_type'], number | null> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  batch_interval: null,
  custom: null,
};

export async function GET() {
  const supabase = createClient();

  const { data: tasks, error } = await supabase
    .from('compliance_tasks')
    .select('*')
    .eq('active', true)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const taskList = (tasks ?? []) as ComplianceTask[];
  if (taskList.length === 0) {
    return NextResponse.json({ tasks: [] });
  }

  const requireBatchCounts = taskList.some((task) => task.frequency_type === 'batch_interval');
  let totalBatchCount: number | null = null;
  if (requireBatchCounts) {
    const { count } = await supabase
      .from('batches')
      .select('id', { count: 'exact', head: true });
    totalBatchCount = typeof count === 'number' ? count : 0;
  }

  const now = Date.now();

  const enriched: ComplianceTaskWithStatus[] = [];

  for (const task of taskList) {
    const { data: latestLog, error: latestError } = await supabase
      .from('compliance_logs')
      .select('*')
      .eq('compliance_task_id', task.id)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError && latestError.code !== 'PGRST116') {
      return NextResponse.json({ error: latestError.message }, { status: 500 });
    }

    const { count: logCount } = await supabase
      .from('compliance_logs')
      .select('id', { count: 'exact', head: true })
      .eq('compliance_task_id', task.id);

    let batchesSinceLast: number | null = null;
    if (task.frequency_type === 'batch_interval') {
      if (latestLog?.completed_at) {
        const { count } = await supabase
          .from('batches')
          .select('id', { count: 'exact', head: true })
          .gt('created_at', latestLog.completed_at);
        batchesSinceLast = typeof count === 'number' ? count : 0;
      } else if (typeof totalBatchCount === 'number') {
        batchesSinceLast = totalBatchCount;
      }
    }

    const intervalDays = INTERVAL_LOOKUP[task.frequency_type];
    let nextDueAt: string | null = null;
    let status: ComplianceTaskWithStatus['status'] = 'not_started';
    let daysOverdue: number | null = null;
    let batchesRemaining: number | null = null;

    if (task.frequency_type === 'batch_interval') {
      if (batchesSinceLast == null) {
        status = 'not_started';
      } else {
        const remaining = Math.max(task.frequency_value - batchesSinceLast, 0);
        batchesRemaining = remaining;
        if (batchesSinceLast >= task.frequency_value) {
          status = 'batch_due';
        } else if (remaining <= 2) {
          status = 'due_soon';
        } else {
          status = 'on_track';
        }
      }
    } else if (latestLog?.completed_at && typeof intervalDays === 'number') {
      const completedAt = Date.parse(latestLog.completed_at);
      if (!Number.isNaN(completedAt)) {
        const addedDays = intervalDays * (task.frequency_value || 1);
        const dueTs = completedAt + addedDays * MS_PER_DAY;
        nextDueAt = new Date(dueTs).toISOString();
        const delta = dueTs - now;
        if (delta < 0) {
          status = 'overdue';
          daysOverdue = Math.ceil(Math.abs(delta) / MS_PER_DAY);
        } else if (delta <= 2 * MS_PER_DAY) {
          status = 'due_soon';
        } else {
          status = 'on_track';
        }
      }
    } else if (!latestLog) {
      status = 'not_started';
    } else {
      status = 'on_track';
    }

    enriched.push({
      ...task,
      latest_log: latestLog ?? null,
      log_count: typeof logCount === 'number' ? logCount : 0,
      next_due_at: nextDueAt,
      status,
      days_overdue: daysOverdue,
      batches_since_last: batchesSinceLast,
      batches_remaining: batchesRemaining,
    });
  }

  return NextResponse.json({ tasks: enriched });
}
