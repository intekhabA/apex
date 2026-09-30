export interface Laboratory {
  id: string;
  code: string;
  name: string;
  legal_name?: string | null;
  registration_number?: string | null;
  tax_identifier?: string | null;
  email: string;
  phone: string;
  website?: string | null;
  address_street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  logo_url?: string | null;
  is_active: boolean;
  subscription_plan: string;
  subscription_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LaboratorySettings {
  id: string;
  lab_id: string;
  report_header_html?: string | null;
  report_footer_html?: string | null;
  report_disclaimer?: string | null;
  currency_code: string;
  currency_symbol: string;
  default_tax_rate: number;
  enable_qr_verification: boolean;
  primary_color_hex: string;
  secondary_color_hex: string;
  default_signatory_name?: string | null;
  default_signatory_designation?: string | null;
  default_signatory_degrees?: string | null;
  default_signatory_reg_no?: string | null;
  default_signatory_signature_url?: string | null;
}

export interface LaboratoryDetail extends Laboratory {
  settings?: LaboratorySettings | null;
  staff_count: number;
}

export interface LaboratoryCreatePayload {
  code: string;
  name: string;
  legal_name?: string;
  registration_number?: string;
  tax_identifier?: string;
  email: string;
  phone: string;
  website?: string;
  address_street: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
  subscription_plan?: string;
  initial_admin_first_name: string;
  initial_admin_last_name: string;
  initial_admin_email: string;
  initial_admin_password: string;
}

export interface LaboratoryUpdatePayload {
  name?: string;
  legal_name?: string;
  registration_number?: string;
  tax_identifier?: string;
  email?: string;
  phone?: string;
  website?: string;
  address_street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  logo_url?: string;
  subscription_plan?: string;
}

export interface LaboratorySettingsUpdatePayload {
  report_header_html?: string;
  report_footer_html?: string;
  report_disclaimer?: string;
  currency_code?: string;
  currency_symbol?: string;
  default_tax_rate?: number;
  enable_qr_verification?: boolean;
  primary_color_hex?: string;
  secondary_color_hex?: string;
  default_signatory_name?: string;
  default_signatory_designation?: string;
  default_signatory_degrees?: string;
  default_signatory_reg_no?: string;
}
