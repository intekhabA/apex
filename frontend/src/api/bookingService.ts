import { apiClient } from './client';
import { APIResponse, Booking, BookingCreatePayload, BookingStatus } from '@/types';

export const bookingService = {
  async getBookings(params?: {
    status?: BookingStatus;
    patient_id?: string;
    search?: string;
  }): Promise<Booking[]> {
    const res = await apiClient.get<APIResponse<Booking[]>>('/bookings', { params });
    return res.data.data || [];
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

