export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SAMPLE_COLLECTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'REFUNDED';

export interface BookingItem {
  id: string;
  item_type: 'TEST' | 'PACKAGE';
  test_id?: string | null;
  package_id?: string | null;
  item_name: string;
  unit_price: number;
  discount_amount: number;
  final_price: number;
}

export interface Booking {
  id: string;
  lab_id: string;
  patient_id: string;
  booking_id_display: string;
  booking_date: string;
  appointment_date: string;
  appointment_time?: string | null;
  referring_doctor?: string | null;
  status: BookingStatus;
  payment_status: PaymentStatus;

  subtotal_amount: number;
  discount_amount: number;
  tax_amount: number;
  grand_total: number;
  paid_amount: number;
  balance_amount: number;

  clinical_notes?: string | null;
  items: BookingItem[];
  created_at: string;
  updated_at: string;
}

export type BookingResponse = Booking;
export type BookingItemResponse = BookingItem;

export interface BookingCreatePayload {
  patient_id: string;
  appointment_date: string;
  appointment_time?: string;
  referring_doctor?: string;
  clinical_notes?: string;
  discount_amount?: number;
  tax_percentage?: number;
  paid_amount?: number;
  items: {
    item_type: 'TEST' | 'PACKAGE';
    test_id?: string;
    package_id?: string;
  }[];
}
