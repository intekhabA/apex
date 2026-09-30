export type NotificationEventType =
  | 'BOOKING_CREATED'
  | 'SAMPLE_COLLECTED'
  | 'REPORT_FINALIZED'
  | 'PAYMENT_RECEIVED'
  | 'CUSTOM';

export type NotificationChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface NotificationLog {
  id: string;
  lab_id: string;
  event_type: NotificationEventType;
  channel: NotificationChannel;
  recipient: string;
  recipient_name: string | null;
  subject: string | null;
  message_body: string;
  status: NotificationStatus;
  error_message: string | null;
  metadata_json: Record<string, unknown> | null;
  sent_at: string | null;
  created_at: string;
}

export interface NotificationFilterParams {
  event_type?: NotificationEventType;
  channel?: NotificationChannel;
  status?: NotificationStatus;
  recipient?: string;
}
