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

  async getBookingAllReportsBlob(
    bookingId: string,
    options?: {
      letterhead?: boolean;
      top_margin_mm?: number;
      bottom_margin_mm?: number;
    }
  ): Promise<Blob> {
    const params = new URLSearchParams();
    if (options?.letterhead !== undefined) {
      params.append('letterhead', String(options.letterhead));
    }
    if (options?.top_margin_mm !== undefined) {
      params.append('top_margin_mm', String(options.top_margin_mm));
    }
    if (options?.bottom_margin_mm !== undefined) {
      params.append('bottom_margin_mm', String(options.bottom_margin_mm));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get(`/bookings/${bookingId}/reports/pdf${query}`, {
      responseType: 'blob',
    });
    return new Blob([res.data], { type: 'application/pdf' });
  },

  async downloadAllReportsPdf(
    bookingId: string,
    filename?: string,
    options?: {
      letterhead?: boolean;
      top_margin_mm?: number;
      bottom_margin_mm?: number;
    }
  ): Promise<void> {
    const blob = await this.getBookingAllReportsBlob(bookingId, options);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || `Booking_${bookingId}_All_Reports.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async printBookingAllReports(
    bookingId: string,
    options?: {
      letterhead?: boolean;
      top_margin_mm?: number;
      bottom_margin_mm?: number;
    }
  ): Promise<void> {
    const blob = await this.getBookingAllReportsBlob(bookingId, options);
    const blobUrl = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        const win = window.open(blobUrl, '_blank');
        win?.focus();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            document.body.removeChild(iframe);
          }
          URL.revokeObjectURL(blobUrl);
        }, 120000);
      }
    };
  },
};

