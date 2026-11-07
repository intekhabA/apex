export interface ContactQuery {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  organization_name?: string | null;
  service_interested?: string | null;
  subject: string;
  message: string;
  status: 'NEW' | 'CONTACTED' | 'RESOLVED' | 'SPAM';
  admin_notes?: string | null;
  ip_address?: string | null;
  created_at: string;
  formatted_time?: string | null;
}

export interface ContactQueryCreatePayload {
  name: string;
  email: string;
  phone?: string;
  organization_name?: string;
  service_interested?: string;
  subject: string;
  message: string;
  website_trap?: string;
  client_time_ms?: number;
  challenge_answer?: string;
  challenge_token?: string;
}

export interface ContactPublicInfo {
  support_email: string;
  contact_phone: string;
  office_address?: string | null;
  working_hours?: string | null;
  challenge_question?: string | null;
  challenge_token?: string | null;
}

export interface ContactSettings {
  id?: string;
  recipient_email: string;
  support_email: string;
  contact_phone: string;
  office_address?: string | null;
  working_hours?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_password?: string | null;
  smtp_from_email?: string | null;
  smtp_from_name?: string | null;
  smtp_use_tls?: boolean | null;
  is_smtp_configured?: boolean;
  notification_subject_template: string;
  notification_body_template: string;
  auto_reply_enabled: boolean;
  auto_reply_subject_template: string;
  auto_reply_body_template: string;
  available_placeholders: string[];
}

export interface ContactSettingsUpdatePayload {
  recipient_email?: string;
  support_email?: string;
  contact_phone?: string;
  office_address?: string;
  working_hours?: string;
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  smtp_password?: string;
  smtp_from_email?: string;
  smtp_from_name?: string;
  smtp_use_tls?: boolean;
  notification_subject_template?: string;
  notification_body_template?: string;
  auto_reply_enabled?: boolean;
  auto_reply_subject_template?: string;
  auto_reply_body_template?: string;
}
