export type SampleStatus =
  | 'REGISTERED'
  | 'COLLECTED'
  | 'RECEIVED'
  | 'PROCESSING'
  | 'REJECTED'
  | 'COMPLETED';

export interface SampleTrackingEvent {
  id: string;
  sample_id: string;
  from_status?: string | null;
  to_status: string;
  performed_by?: string | null;
  performer_name?: string | null;
  remarks?: string | null;
  created_at: string;
}

export interface SpecimenSample {
  id: string;
  lab_id: string;
  booking_id: string;
  patient_id: string;
  sample_id_display: string;
  sample_type: string;
  sample_container?: string | null;
  status: SampleStatus;
  collected_at?: string | null;
  collected_by?: string | null;
  received_at?: string | null;
  received_by?: string | null;
  rejection_reason?: string | null;
  barcode_value?: string | null;
  events?: SampleTrackingEvent[];
  created_at: string;
}
