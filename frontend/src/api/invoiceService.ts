import { apiClient } from './client';
import { APIResponse, PaginatedResponse } from '@/types/api';
import { InvoiceResponse, PaymentResponse, PaymentCreate } from '@/types/invoice';
import { printReceiptFromInvoice } from '@/utils/receiptPrinter';

export interface InvoiceQueryParams {
  payment_status?: string;
  patient_id?: string;
  search?: string;
  page?: number;
  limit?: number;
  all?: boolean;
}

export const invoiceService = {
  async getInvoices(params?: InvoiceQueryParams): Promise<PaginatedResponse<InvoiceResponse>> {
    const res = await apiClient.get<APIResponse<InvoiceResponse[]>>('/invoices', { params });
    const items = res.data.data || [];
    const meta = res.data.meta || {
      page: params?.page || 1,
      limit: params?.limit || items.length || 20,
      total: items.length,
      total_pages: 1,
    };
    return { items, meta };
  },

  async getInvoice(id: string): Promise<InvoiceResponse> {
    const res = await apiClient.get<APIResponse<InvoiceResponse>>(`/invoices/${id}`);
    return res.data.data!;
  },

  async recordPayment(
    invoiceId: string,
    payload: PaymentCreate
  ): Promise<PaymentResponse> {
    const res = await apiClient.post<APIResponse<PaymentResponse>>(
      `/invoices/${invoiceId}/payments`,
      payload
    );
    return res.data.data!;
  },

  async downloadReceiptPdf(invoiceId: string, filename?: string): Promise<void> {
    const res = await apiClient.get(`/invoices/${invoiceId}/receipt`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || `Receipt_${invoiceId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async printReceipt(invoiceId: string, labName?: string): Promise<void> {
    try {
      const inv = await invoiceService.getInvoice(invoiceId);
      let bookingData = null;
      if (inv.booking_id) {
        try {
          const bRes = await apiClient.get<APIResponse<any>>(`/bookings/${inv.booking_id}`);
          bookingData = bRes.data.data;
        } catch {
          // Ignore error fetching booking
        }
      }
      printReceiptFromInvoice(inv, labName, bookingData);
    } catch (err) {
      console.error('Failed to retrieve invoice for receipt print:', err);
      // Fallback: download PDF
      await invoiceService.downloadReceiptPdf(invoiceId);
    }
  },
};
