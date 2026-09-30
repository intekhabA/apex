import { apiClient } from './client';
import { APIResponse } from '@/types/api';
import { InvoiceResponse, PaymentResponse, PaymentCreate } from '@/types/invoice';

export const invoiceService = {
  async getInvoices(params?: {
    payment_status?: string;
    patient_id?: string;
    search?: string;
  }): Promise<InvoiceResponse[]> {
    const res = await apiClient.get<APIResponse<InvoiceResponse[]>>('/invoices', { params });
    return res.data.data || [];
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
};
