import { apiClient } from './client';
import {
  APIResponse,
  MessageResponse,
  ImagingReport,
  ImagingTemplate,
  ImagingAttachment,
  ImagingReportUpdatePayload,
} from '@/types';

export const imagingService = {
  async getTemplates(params?: {
    search?: string;
    modality?: string;
    test_id?: string;
    is_active?: boolean;
    scope?: 'all' | 'system' | 'lab';
  }): Promise<ImagingTemplate[]> {
    const res = await apiClient.get<APIResponse<ImagingTemplate[]>>('/imaging/templates', { params });
    return res.data.data || [];
  },

  async listAdminTemplates(params?: {
    search?: string;
    modality?: string;
    is_active?: boolean;
    scope?: 'all' | 'system' | 'lab';
  }): Promise<ImagingTemplate[]> {
    const res = await apiClient.get<APIResponse<ImagingTemplate[]>>('/imaging/templates', { params });
    return res.data.data || [];
  },

  async getTemplate(id: string): Promise<ImagingTemplate> {
    const res = await apiClient.get<APIResponse<ImagingTemplate>>(`/imaging/templates/${id}`);
    return res.data.data!;
  },

  async createTemplate(payload: import('@/types').ImagingTemplateCreatePayload): Promise<ImagingTemplate> {
    const res = await apiClient.post<APIResponse<ImagingTemplate>>('/imaging/templates', payload);
    return res.data.data!;
  },

  async updateTemplate(
    id: string,
    payload: import('@/types').ImagingTemplateUpdatePayload
  ): Promise<ImagingTemplate> {
    const res = await apiClient.put<APIResponse<ImagingTemplate>>(`/imaging/templates/${id}`, payload);
    return res.data.data!;
  },

  async deleteTemplate(id: string): Promise<MessageResponse> {
    const res = await apiClient.delete<MessageResponse>(`/imaging/templates/${id}`);
    return res.data;
  },

  async getImagingReport(reportId: string): Promise<ImagingReport> {
    const res = await apiClient.get<APIResponse<ImagingReport>>(`/imaging/${reportId}`);
    return res.data.data!;
  },

  async updateImagingReport(
    reportId: string,
    payload: ImagingReportUpdatePayload
  ): Promise<ImagingReport> {
    const res = await apiClient.put<APIResponse<ImagingReport>>(
      `/imaging/${reportId}`,
      payload
    );
    return res.data.data!;
  },

  async uploadAttachment(
    reportId: string,
    file: File,
    caption?: string
  ): Promise<ImagingAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (caption) {
      formData.append('caption', caption);
    }
    const res = await apiClient.post<APIResponse<ImagingAttachment>>(
      `/imaging/${reportId}/attachments`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return res.data.data!;
  },

  async deleteAttachment(reportId: string, attachmentId: string): Promise<MessageResponse> {
    const res = await apiClient.delete<APIResponse<MessageResponse>>(
      `/imaging/${reportId}/attachments/${attachmentId}`
    );
    return res.data.data!;
  },
};
