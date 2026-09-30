import { apiClient } from './client';
import {
  APIResponse,
  ReportListItem,
  ReportDetail,
  ReportStatus,
  PublicVerification,
} from '@/types';

export const reportService = {
  async getReports(params?: {
    status?: ReportStatus;
    search?: string;
    patient_id?: string;
    booking_id?: string;
  }): Promise<ReportListItem[]> {
    const res = await apiClient.get<APIResponse<ReportListItem[]>>('/reports', { params });
    return res.data.data || [];
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

  async downloadReportPdf(reportId: string, filename: string): Promise<void> {
    const res = await apiClient.get(`/reports/${reportId}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  async verifyReportPublic(token: string): Promise<PublicVerification> {
    const res = await apiClient.get<APIResponse<PublicVerification>>(`/reports/verify/${token}`);
    return res.data.data!;
  },
};
