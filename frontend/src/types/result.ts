export type ResultFlag =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'CRITICAL_LOW'
  | 'CRITICAL_HIGH'
  | 'ABNORMAL';

export type ReportStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'REVIEWED'
  | 'APPROVED'
  | 'FINAL'
  | 'CANCELLED';

export interface PendingWorklistReport {
  report_id: string;
  report_id_display: string;
  booking_id: string;
  booking_id_display: string;
  patient_name: string;
  patient_id_display: string;
  test_name: string;
  test_code: string;
  sample_type: string;
  status: ReportStatus;
  created_at: string;
}

export interface ResultValueResponse {
  id: string;
  parameter_id: string;
  parameter_name: string;
  parameter_code: string;
  numeric_value?: number | null;
  text_value?: string | null;
  unit?: string | null;
  reference_range_display?: string | null;
  flag: ResultFlag;
  technician_comment?: string | null;
}

export interface ResultSheetResponse {
  report_id: string;
  report_id_display: string;
  lab_id: string;
  booking_id: string;
  patient_id: string;
  patient_name: string;
  patient_gender: string;
  patient_age_years: number;
  test_id: string;
  test_name: string;
  test_code: string;
  sample_id?: string | null;
  sample_id_display?: string | null;
  status: ReportStatus;
  values: ResultValueResponse[];
  created_at: string;
  updated_at: string;
}

export interface ParameterValueInput {
  parameter_id: string;
  numeric_value?: number | null;
  text_value?: string | null;
  technician_comment?: string | null;
}

export interface ResultEntryPayload {
  values: ParameterValueInput[];
  submit_for_review?: boolean;
}
