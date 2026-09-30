import { ReportStatus, ResultValueResponse } from './result';
import { ImagingAttachment } from './imaging';

export interface ReportVersion {
  id: string;
  version_number: number;
  amendment_reason: string;
  amended_by_name?: string | null;
  pdf_snapshot_url?: string | null;
  created_at: string;
}

export interface ReportListItem {
  id: string;
  report_id_display: string;
  booking_id: string;
  booking_id_display: string;
  patient_id: string;
  patient_name: string;
  patient_id_display: string;
  test_id: string;
  test_name: string;
  test_code: string;
  sample_type: string;
  status: ReportStatus;
  current_version: number;
  is_immutable: boolean;
  pdf_file_url?: string | null;
  approved_by_name?: string | null;
  finalized_at?: string | null;
  created_at: string;
}

export interface ReportDetail {
  id: string;
  report_id_display: string;
  lab_id: string;
  lab_name: string;
  booking_id: string;
  booking_id_display: string;
  patient_id: string;
  patient_name: string;
  patient_gender: string;
  patient_age_years: number;
  test_id: string;
  test_name: string;
  test_code: string;
  status: ReportStatus;
  current_version: number;
  is_immutable: boolean;
  verification_token?: string | null;
  pdf_file_url?: string | null;
  hmac_digest?: string | null;
  clinical_history?: string | null;
  imaging_findings?: string | null;
  imaging_impression?: string | null;
  recommendations?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  finalized_at?: string | null;
  result_values: ResultValueResponse[];
  attachments: ImagingAttachment[];
  versions: ReportVersion[];
  created_at: string;
  updated_at: string;
}

export interface PublicVerification {
  is_valid: boolean;
  verification_token: string;
  report_id_display: string;
  lab_name: string;
  patient_name_masked: string;
  patient_gender: string;
  patient_age_years: number;
  test_name: string;
  test_code: string;
  status: ReportStatus;
  version_number: number;
  finalized_at?: string | null;
  hmac_digest_truncated: string;
  verified_at: string;
}
