import { BookingResponse } from './booking';
import { ReportListItem } from './report';
import { InvoiceResponse } from './invoice';

export interface PatientProfile {
  id: string;
  patient_id_display: string;
  first_name: string;
  last_name: string;
  full_name: string;
  gender: string;
  age_years: number;
  age_months: number;
  phone: string;
  email?: string | null;
  blood_group?: string | null;
  address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  laboratory_name?: string | null;
}

export interface PatientDashboardData {
  profile: PatientProfile | null;
  total_bookings: number;
  completed_reports: number;
  total_invoiced: number | string;
  total_paid: number | string;
  outstanding_balance: number | string;
  recent_bookings: BookingResponse[];
  recent_reports: ReportListItem[];
  recent_invoices: InvoiceResponse[];
}
