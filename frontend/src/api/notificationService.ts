import { apiClient } from './client';
import { APIResponse } from '@/types/api';
import { NotificationLog, NotificationFilterParams } from '@/types/notification';

export const notificationService = {
  async getNotifications(params?: NotificationFilterParams): Promise<NotificationLog[]> {
    const res = await apiClient.get<APIResponse<NotificationLog[]>>('/notifications', { params });
    return res.data.data || [];
  },
};
