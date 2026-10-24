import { apiClient } from './client';
import { APIResponse, PaginatedResponse } from '@/types/api';
import { BookingResponse } from '@/types/booking';
import { ReportListItem, ReportDetail } from '@/types/report';
import { InvoiceResponse } from '@/types/invoice';
import { PatientProfile, PatientDashboardData } from '@/types/patientPortal';

export const patientPortalService = {
  async getProfile(): Promise<PatientProfile | null> {
    const res = await apiClient.get<APIResponse<PatientProfile | null>>('/patient-portal/profile');
    return res.data.data ?? null;
  },

  async getDashboard(): Promise<PatientDashboardData> {
    const res = await apiClient.get<APIResponse<PatientDashboardData>>('/patient-portal/dashboard');
    return res.data.data!;
  },

  async getBookingsPaginated(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<BookingResponse>> {
    const res = await apiClient.get<APIResponse<BookingResponse[]>>('/patient-portal/bookings', { params });
    const items = res.data.data || [];
    const meta = res.data.meta || { page: params?.page || 1, limit: params?.limit || items.length || 20, total: items.length, total_pages: 1 };
    return { items, meta };
  },

  async getBookings(): Promise<BookingResponse[]> {
    const res = await apiClient.get<APIResponse<BookingResponse[]>>('/patient-portal/bookings', { params: { all: true } });
    return res.data.data || [];
  },

  async getReportsPaginated(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<ReportListItem>> {
    const res = await apiClient.get<APIResponse<ReportListItem[]>>('/patient-portal/reports', { params });
    const items = res.data.data || [];
    const meta = res.data.meta || { page: params?.page || 1, limit: params?.limit || items.length || 20, total: items.length, total_pages: 1 };
    return { items, meta };
  },

  async getReports(): Promise<ReportListItem[]> {
    const res = await apiClient.get<APIResponse<ReportListItem[]>>('/patient-portal/reports', { params: { all: true } });
    return res.data.data || [];
  },

  async getReportDetail(reportId: string): Promise<ReportDetail> {
    const res = await apiClient.get<APIResponse<ReportDetail>>(`/patient-portal/reports/${reportId}`);
    return res.data.data!;
  },

  async downloadReportPdf(reportId: string, filename?: string): Promise<void> {
    const res = await apiClient.get(`/patient-portal/reports/${reportId}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || `Report_${reportId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async getInvoicesPaginated(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<InvoiceResponse>> {
    const res = await apiClient.get<APIResponse<InvoiceResponse[]>>('/patient-portal/invoices', { params });
    const items = res.data.data || [];
    const meta = res.data.meta || { page: params?.page || 1, limit: params?.limit || items.length || 20, total: items.length, total_pages: 1 };
    return { items, meta };
  },

  async getInvoices(): Promise<InvoiceResponse[]> {
    const res = await apiClient.get<APIResponse<InvoiceResponse[]>>('/patient-portal/invoices', { params: { all: true } });
    return res.data.data || [];
  },

  async downloadReceiptPdf(invoiceId: string, filename?: string): Promise<void> {
    const res = await apiClient.get(`/patient-portal/invoices/${invoiceId}/receipt`, {
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

  async downloadBookingAllReportsPdf(bookingId: string, filename?: string): Promise<void> {
    const res = await apiClient.get(`/patient-portal/bookings/${bookingId}/reports/pdf`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || `Booking_${bookingId}_All_Reports.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

