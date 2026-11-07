import { apiClient } from './client';
import { APIResponse, PaginatedResponse } from '@/types';
import {
  ContactQuery,
  ContactQueryCreatePayload,
  ContactPublicInfo,
  ContactSettings,
  ContactSettingsUpdatePayload,
} from '@/types/contact';

export const contactApi = {
  // Public
  async getPublicInfo(): Promise<ContactPublicInfo> {
    const res = await apiClient.get<APIResponse<ContactPublicInfo>>('/contact/public-info');
    return (
      res.data.data || {
        support_email: 'support@trustmylab.in',
        contact_phone: '+91 94150 05517',
        office_address: 'Cyber City, Block A, Gurugram, India',
        working_hours: 'Monday – Saturday: 8:00 AM – 8:00 PM IST',
      }
    );
  },

  async getChallenge(): Promise<{ question: string; token: string }> {
    const res = await apiClient.get<APIResponse<{ question: string; token: string }>>('/contact/challenge');
    return res.data.data!;
  },

  async submitContact(
    payload: ContactQueryCreatePayload
  ): Promise<APIResponse<{ ticket_id: string; name: string; email: string; submitted_at: string }>> {
    const res = await apiClient.post<
      APIResponse<{ ticket_id: string; name: string; email: string; submitted_at: string }>
    >('/contact', payload);
    return res.data;
  },

  // Admin Settings & Templates
  async getSettings(): Promise<ContactSettings> {
    const res = await apiClient.get<APIResponse<ContactSettings>>('/contact/settings');
    if (!res.data.data) {
      throw new Error('Failed to load contact settings');
    }
    return res.data.data;
  },

  async updateSettings(payload: ContactSettingsUpdatePayload): Promise<ContactSettings> {
    const res = await apiClient.put<APIResponse<ContactSettings>>('/contact/settings', payload);
    if (!res.data.data) {
      throw new Error('Failed to update contact settings');
    }
    return res.data.data;
  },

  async resetTemplates(): Promise<ContactSettings> {
    const res = await apiClient.post<APIResponse<ContactSettings>>('/contact/settings/reset');
    if (!res.data.data) {
      throw new Error('Failed to reset contact settings');
    }
    return res.data.data;
  },

  async sendTestEmail(): Promise<{ recipient: string; dispatched: boolean }> {
    const res = await apiClient.post<APIResponse<{ recipient: string; dispatched: boolean }>>(
      '/contact/settings/test-email'
    );
    if (!res.data.data) {
      throw new Error('Failed to dispatch test email');
    }
    return res.data.data;
  },

  // Admin Inquiries / Leads List
  async listQueries(params?: {
    search?: string;
    status_filter?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<ContactQuery>> {
    const res = await apiClient.get<APIResponse<ContactQuery[]>>('/contact/queries', { params });
    const items = res.data.data || [];
    return {
      items,
      meta: res.data.meta || { total: items.length, page: 1, limit: 20, total_pages: 1 },
    };
  },

  async updateQueryStatus(
    queryId: string,
    payload: { status: string; admin_notes?: string }
  ): Promise<ContactQuery> {
    const res = await apiClient.patch<APIResponse<ContactQuery>>(
      `/contact/queries/${queryId}/status`,
      payload
    );
    if (!res.data.data) {
      throw new Error('Failed to update query status');
    }
    return res.data.data;
  },
};
