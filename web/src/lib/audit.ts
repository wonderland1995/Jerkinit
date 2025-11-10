import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type AuditEvent = {
  userId?: string | null;
  actorEmail?: string | null;
  action: string;
  resource?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

export async function recordAuditEvent(event: AuditEvent) {
  if (!event.action) {
    console.warn('Attempted to record audit event without action label.');
    return;
  }

  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: event.userId ?? null,
      actor_email: event.actorEmail ?? null,
      action: event.action,
      resource: event.resource ?? null,
      resource_id: event.resourceId ?? null,
      metadata: event.metadata ?? null,
      ip_address: event.ipAddress ?? null,
    });
  } catch (error) {
    console.error('Failed to write audit log', error);
  }
}
