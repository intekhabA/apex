import { apiClient } from './client';
import {
  APIResponse,
  PaginatedResponse,
  ReportListItem,
  ReportDetail,
  ReportStatus,
  PublicVerification,
} from '@/types';

export interface ReportQueryParams {
  status?: ReportStatus;
  search?: string;
  patient_id?: string;
  booking_id?: string;
  page?: number;
  limit?: number;
  all?: boolean;
}

export const reportService = {
  async getReports(params?: ReportQueryParams): Promise<PaginatedResponse<ReportListItem>> {
    const res = await apiClient.get<APIResponse<ReportListItem[]>>('/reports', { params });
    const items = res.data.data || [];
    const meta = res.data.meta || {
      page: params?.page || 1,
      limit: params?.limit || items.length || 20,
      total: items.length,
      total_pages: 1,
    };
    return { items, meta };
  },

  async getReportDetail(reportId: string): Promise<ReportDetail> {
    const res = await apiClient.get<APIResponse<ReportDetail>>(`/reports/${reportId}`);
    return res.data.data!;
  },

  async approveReport(reportId: string): Promise<ReportDetail> {
    const res = await apiClient.post<APIResponse<ReportDetail>>(`/reports/${reportId}/approve`);
    return res.data.data!;
  },

  async finalizeReport(reportId: string): Promise<ReportDetail> {
    const res = await apiClient.post<APIResponse<ReportDetail>>(`/reports/${reportId}/finalize`);
    return res.data.data!;
  },

  async amendReport(reportId: string, amendmentReason: string): Promise<ReportDetail> {
    const res = await apiClient.post<APIResponse<ReportDetail>>(
      `/reports/${reportId}/amend`,
      { amendment_reason: amendmentReason }
    );
    return res.data.data!;
  },

  async downloadReportPdf(
    reportId: string,
    filename: string,
    options?: {
      show_header_status?: boolean;
      show_qr_side_text?: boolean;
      letterhead?: boolean;
      top_margin_mm?: number;
      bottom_margin_mm?: number;
    }
  ): Promise<void> {
    const blob = await this.getReportPdfBlob(reportId, options);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async getReportPdfBlob(
    reportId: string,
    options?: {
      show_header_status?: boolean;
      show_qr_side_text?: boolean;
      letterhead?: boolean;
      top_margin_mm?: number;
      bottom_margin_mm?: number;
    }
  ): Promise<Blob> {
    const params = new URLSearchParams();
    if (options?.show_header_status !== undefined) {
      params.append('show_header_status', String(options.show_header_status));
    }
    if (options?.show_qr_side_text !== undefined) {
      params.append('show_qr_side_text', String(options.show_qr_side_text));
    }
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
    const res = await apiClient.get(`/reports/${reportId}/download${query}`, {
      responseType: 'blob',
    });
    return new Blob([res.data], { type: 'application/pdf' });
  },

  async printReport(
    reportId: string,
    options?: {
      letterhead?: boolean;
      top_margin_mm?: number;
      bottom_margin_mm?: number;
      show_header_status?: boolean;
      show_qr_side_text?: boolean;
    }
  ): Promise<void> {
    const blob = await this.getReportPdfBlob(reportId, options);
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

  async verifyReportPublic(token: string): Promise<PublicVerification> {
    const res = await apiClient.get<APIResponse<PublicVerification>>(`/reports/verify/${token}`);
    return res.data.data!;
  },
};
