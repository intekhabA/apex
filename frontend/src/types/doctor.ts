export interface Doctor {
  id: string;
  lab_id: string;
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  specialization?: string;
  clinic_hospital_name?: string;
  default_commission_percentage: number | string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DoctorCreatePayload {
  name: string;
  code?: string;
  phone?: string;
  email?: string;
  specialization?: string;
  clinic_hospital_name?: string;
  default_commission_percentage: number;
  is_active?: boolean;
}

export interface DoctorTestCommissionItem {
  test_id: string;
  test_name?: string;
  test_code?: string;
  category_name?: string;
  standard_price?: number | string;
  commission_percentage: number | string;
  is_custom: boolean;
}

export interface DoctorSummaryItem {
  doctor_id?: string;
  doctor_name: string;
  specialization?: string;
  phone?: string;
  clinic_hospital_name?: string;
  default_commission_percentage: number | string;
  total_income: number | string;
  total_commission: number | string;
  effective_percentage: number | string;
  total_tests: number;
  total_patients: number;
  total_bookings: number;
}

export interface CommissionTestBreakdownItem {
  test_id?: string;
  test_name: string;
  test_code?: string;
  category_name?: string;
  tests_count: number;
  total_income: number | string;
  commission_percentage: number | string;
  is_custom_percentage: boolean;
  commission_amount: number | string;
}

export interface CommissionPatientLedgerItem {
  booking_id: string;
  booking_id_display: string;
  booking_date: string;
  patient_id: string;
  patient_name: string;
  patient_mrn?: string;
  doctor_name: string;
  test_id?: string;
  test_name: string;
  test_price: number | string;
  commission_percentage: number | string;
  commission_amount: number | string;
  payment_status: string;
}

export interface CommissionTrendItem {
  period_label: string;
  total_income: number | string;
  total_commission: number | string;
  tests_count: number;
}

export interface DoctorCommissionReport {
  period_type: 'daily' | 'monthly' | 'custom';
  start_date: string;
  end_date: string;
  doctor_filter?: string;
  doctor_id_filter?: string;
  total_income: number | string;
  total_commission: number | string;
  effective_percentage: number | string;
  total_tests: number;
  total_patients: number;
  total_bookings: number;
  doctors_summary: DoctorSummaryItem[];
  test_breakdown: CommissionTestBreakdownItem[];
  patient_ledger: CommissionPatientLedgerItem[];
  trends: CommissionTrendItem[];
}
