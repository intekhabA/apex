import { apiClient } from './client';
import { APIResponse } from '@/types/api';
import { LabDashboardData, SuperAdminDashboardData } from '@/types/dashboard';

export const dashboardService = {
  async getLabDashboard(): Promise<LabDashboardData> {
    const res = await apiClient.get<APIResponse<LabDashboardData>>('/lab/dashboard');
    return res.data.data!;
  },

  async getSuperAdminDashboard(): Promise<SuperAdminDashboardData> {
    const res = await apiClient.get<APIResponse<SuperAdminDashboardData>>('/admin/dashboard');
    return res.data.data!;
  },
};
