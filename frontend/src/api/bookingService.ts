import { apiClient } from './client';
import { APIResponse, PaginatedResponse, Booking, BookingCreatePayload, BookingStatus } from '@/types';

export interface BookingQueryParams {
  status?: BookingStatus;
  patient_id?: string;
  search?: string;
  page?: number;
  limit?: number;
  all?: boolean;
}

export const bookingService = {
  async getBookings(params?: BookingQueryParams): Promise<PaginatedResponse<Booking>> {
    const res = await apiClient.get<APIResponse<Booking[]>>('/bookings', { params });
    const items = res.data.data || [];
    const meta = res.data.meta || {
      page: params?.page || 1,
      limit: params?.limit || items.length || 20,
      total: items.length,
      total_pages: 1,
    };
    return { items, meta };
  },

  async getBookingById(id: string): Promise<Booking> {
    const res = await apiClient.get<APIResponse<Booking>>(`/bookings/${id}`);
    return res.data.data!;
  },

  async createBooking(payload: BookingCreatePayload): Promise<Booking> {
    const res = await apiClient.post<APIResponse<Booking>>('/bookings', payload);
    return res.data.data!;
  },

  async updateBookingStatus(id: string, status: BookingStatus): Promise<Booking> {
    const res = await apiClient.patch<APIResponse<Booking>>(`/bookings/${id}/status`, { status });
    return res.data.data!;
  },

  async cancelBooking(id: string): Promise<void> {
    await apiClient.delete(`/bookings/${id}`);
  },

  async downloadAllReportsPdf(bookingId: string, filename?: string): Promise<void> {
    const res = await apiClient.get(`/bookings/${bookingId}/reports/pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || `Booking_${bookingId}_All_Reports.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

