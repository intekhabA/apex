import { ReportStatus } from './result';

export interface ImagingAttachment {
  id: string;
  report_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  storage_path: string;
  caption?: string | null;
  uploaded_by?: string | null;
  created_at: string;
}

export interface ImagingReport {
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
  status: ReportStatus;
  clinical_history?: string | null;
  imaging_findings?: string | null;
  imaging_impression?: string | null;
  recommendations?: string | null;
  attachments: ImagingAttachment[];
  created_at: string;
  updated_at: string;
}

export interface ImagingTemplate {
  id: string;
  name: string;
  modality: 'USG' | 'X-RAY' | 'CT' | 'MRI' | string;
  clinical_history_template: string;
  findings_template: string;
  impression_template: string;
  recommendations_template: string;
}

export interface ImagingReportUpdatePayload {
  clinical_history?: string | null;
  imaging_findings?: string | null;
  imaging_impression?: string | null;
  recommendations?: string | null;
  submit_for_review?: boolean;
}
