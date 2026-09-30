export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface Patient {
  id: string;
  lab_id: string;
  patient_id_display: string;
  first_name: string;
  last_name: string;
  full_name: string;
  gender: Gender;
  date_of_birth?: string | null;
  age_years: number;
  age_months: number;
  phone: string;
  email?: string | null;
  blood_group?: string | null;
  address_street?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  referring_doctor?: string | null;
  clinical_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatientCreatePayload {
  first_name: string;
  last_name: string;
  gender: Gender;
  date_of_birth?: string;
  age_years: number;
  age_months?: number;
  phone: string;
  email?: string;
  blood_group?: string;
  address_street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  referring_doctor?: string;
  clinical_notes?: string;
}

export interface TimelineEvent {
  event_type: string;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, any>;
}
