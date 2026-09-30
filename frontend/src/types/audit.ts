export interface AuditLog {
  id: string;
  lab_id: string | null;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  entity_name: string;
  entity_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  before_state_json: Record<string, unknown> | null;
  after_state_json: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogFilterParams {
  action?: string;
  entity_name?: string;
  entity_id?: string;
  user_email?: string;
  lab_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}
