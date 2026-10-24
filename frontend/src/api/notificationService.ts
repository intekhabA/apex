import { apiClient } from './client';
import { APIResponse, PaginatedResponse } from '@/types/api';
import { NotificationLog, NotificationFilterParams } from '@/types/notification';

export interface NotificationQueryParams extends NotificationFilterParams {
  page?: number;
  limit?: number;
  all?: boolean;
}

export const notificationService = {
  async getNotifications(
    params?: NotificationQueryParams
  ): Promise<PaginatedResponse<NotificationLog>> {
    const res = await apiClient.get<APIResponse<NotificationLog[]>>('/notifications', { params });
    const items = res.data.data || [];
    const meta = res.data.meta || {
      page: params?.page || 1,
      limit: params?.limit || items.length || 20,
      total: items.length,
      total_pages: 1,
    };
    return { items, meta };
  },
};
