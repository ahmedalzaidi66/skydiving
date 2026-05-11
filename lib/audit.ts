import { adminSupabase } from '@/lib/supabase';

export type AuditAction =
  | 'product.create'
  | 'product.update'
  | 'product.delete'
  | 'product.restore'
  | 'category.create'
  | 'category.update'
  | 'category.delete'
  | 'category.restore'
  | 'order.status_update'
  | 'order.cancel'
  | 'coupon.create'
  | 'coupon.update'
  | 'coupon.delete'
  | 'coupon.restore'
  | 'hero_slide.create'
  | 'hero_slide.update'
  | 'hero_slide.delete'
  | 'settings.update'
  | 'employee.create'
  | 'employee.update'
  | 'employee.delete'
  | 'employee.role_change'
  | 'permissions.role_update'
  | 'permissions.employee_update'
  | 'used_gear.approve'
  | 'used_gear.reject'
  | 'used_gear.verify_seller'
  | 'used_gear.hide'
  | 'used_gear.restore';

export type EntityType =
  | 'product'
  | 'category'
  | 'order'
  | 'coupon'
  | 'hero_slide'
  | 'settings'
  | 'employee'
  | 'permissions'
  | 'used_gear';

export type AuditLog = {
  id: string;
  admin_user_id: string;
  admin_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

export type LogAuditParams = {
  adminId: string;
  adminEmail: string;
  action: AuditAction;
  entityType: EntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
};

// Fields that must never appear in audit log values
const REDACTED_FIELDS = new Set([
  'password', 'token', 'session_token_hash', 'secret', 'key',
  'credit_card', 'cvv', 'card_number', 'access_token', 'refresh_token',
]);

function redact(obj: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!obj) return null;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    clean[k] = REDACTED_FIELDS.has(k.toLowerCase()) ? '[redacted]' : v;
  }
  return clean;
}

/**
 * Write an audit log entry via the secure `insert_audit_log` RPC.
 * Fires-and-forgets — never throws, so audit failures don't break admin UX.
 */
export async function logAudit(params: LogAuditParams): Promise<void> {
  const {
    adminId, adminEmail, action, entityType,
    entityId = null, entityLabel = null,
    oldValues = null, newValues = null,
  } = params;

  const ua =
    typeof navigator !== 'undefined' ? navigator.userAgent?.slice(0, 300) : null;

  try {
    await adminSupabase().rpc('insert_audit_log', {
      p_admin_user_id: adminId,
      p_admin_email:   adminEmail,
      p_action:        action,
      p_entity_type:   entityType,
      p_entity_id:     entityId,
      p_entity_label:  entityLabel,
      p_old_values:    redact(oldValues ?? undefined),
      p_new_values:    redact(newValues ?? undefined),
      p_ip_address:    null,
      p_user_agent:    ua,
    });
  } catch {
    // Non-fatal — audit failure must never block admin actions
  }
}

/** Fetch audit logs for the viewer, with optional filters. */
export async function fetchAuditLogs(opts: {
  entityType?: string;
  action?: string;
  adminEmail?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: AuditLog[]; count: number; error: string | null }> {
  const {
    entityType, action, adminEmail,
    dateFrom, dateTo,
    limit = 50, offset = 0,
  } = opts;

  let q = adminSupabase()
    .from('admin_audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (entityType) q = q.eq('entity_type', entityType);
  if (action)     q = q.eq('action', action);
  if (adminEmail) q = q.ilike('admin_email', `%${adminEmail}%`);
  if (dateFrom)   q = q.gte('created_at', dateFrom);
  if (dateTo)     q = q.lte('created_at', dateTo + 'T23:59:59Z');

  const { data, error, count } = await q;

  if (error) return { data: [], count: 0, error: error.message };
  return { data: (data ?? []) as AuditLog[], count: count ?? 0, error: null };
}
