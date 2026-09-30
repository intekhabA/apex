export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'NET_BANKING' | 'CHEQUE' | 'OTHER';

export type InvoicePaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'REFUNDED';

export interface PaymentResponse {
  id: string;
  invoice_id: string;
  lab_id: string;
  payment_method: PaymentMethod;
  amount: number | string;
  transaction_reference?: string | null;
  receipt_id_display: string;
  received_by_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface InvoiceResponse {
  id: string;
  lab_id: string;
  booking_id: string;
  booking_id_display: string;
  patient_id: string;
  patient_name: string;
  patient_id_display: string;
  invoice_id_display: string;
  invoice_date: string;
  subtotal: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  grand_total: number | string;
  paid_amount: number | string;
  balance_amount: number | string;
  payment_status: InvoicePaymentStatus;
  pdf_url?: string | null;
  notes?: string | null;
  payments: PaymentResponse[];
  created_at: string;
  updated_at: string;
}

export interface PaymentCreate {
  amount: number;
  payment_method: PaymentMethod;
  transaction_reference?: string;
  notes?: string;
}
