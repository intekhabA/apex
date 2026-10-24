import { apiClient } from './client';
import {
  APIResponse,
  Laboratory,
  LaboratoryDetail,
  LaboratoryCreatePayload,
  LaboratoryUpdatePayload,
  LaboratorySettings,
  LaboratorySettingsUpdatePayload,
  UserResponse,
} from '@/types';

export interface ListLabsParams {
  search?: string;
  is_active?: boolean;
}

export interface SuperAdminDashboardStats {
  total_laboratories: number;
  active_laboratories: number;
  total_users: number;
  total_patients: number;
  total_tests: number;
}

export const adminApi = {
  listLaboratories: async (params?: ListLabsParams): Promise<Laboratory[]> => {
    const res = await apiClient.get<APIResponse<Laboratory[]>>('/admin/laboratories', {
      params,
    });
    return res.data.data || [];
  },

  onboardLaboratory: async (payload: LaboratoryCreatePayload): Promise<Laboratory> => {
    const res = await apiClient.post<APIResponse<Laboratory>>('/admin/laboratories', payload);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to onboard laboratory');
    }
    return res.data.data;
  },

  getLaboratory: async (labId: string): Promise<LaboratoryDetail> => {
    const res = await apiClient.get<APIResponse<LaboratoryDetail>>(`/admin/laboratories/${labId}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch laboratory');
    }
    return res.data.data;
  },

  getLaboratorySettings: async (labId: string): Promise<LaboratorySettings> => {
    const res = await apiClient.get<APIResponse<LaboratorySettings>>(`/admin/laboratories/${labId}/settings`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch laboratory settings');
    }
    return res.data.data;
  },

  updateLaboratorySettings: async (
    labId: string,
    payload: LaboratorySettingsUpdatePayload
  ): Promise<LaboratorySettings> => {
    const res = await apiClient.put<APIResponse<LaboratorySettings>>(
      `/admin/laboratories/${labId}/settings`,
      payload
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update laboratory settings');
    }
    return res.data.data;
  },

  updateLaboratory: async (
    labId: string,
    payload: LaboratoryUpdatePayload
  ): Promise<Laboratory> => {
    const res = await apiClient.put<APIResponse<Laboratory>>(
      `/admin/laboratories/${labId}`,
      payload
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update laboratory');
    }
    return res.data.data;
  },

  updateLaboratoryStatus: async (labId: string, isActive: boolean): Promise<Laboratory> => {
    const res = await apiClient.patch<APIResponse<Laboratory>>(
      `/admin/laboratories/${labId}/status`,
      { is_active: isActive }
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update laboratory status');
    }
    return res.data.data;
  },

  getLaboratoryStaff: async (labId: string): Promise<UserResponse[]> => {
    const res = await apiClient.get<APIResponse<UserResponse[]>>(
      `/admin/laboratories/${labId}/staff`
    );
    return res.data.data || [];
  },

  getDashboard: async (): Promise<SuperAdminDashboardStats> => {
    const res = await apiClient.get<APIResponse<SuperAdminDashboardStats>>('/admin/dashboard');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch dashboard stats');
    }
    return res.data.data;
  },

  // Laboratory Test Assignment & Pricing
  getLaboratoryTests: async (
    labId: string,
    params?: { category_id?: string; search?: string; assigned_only?: boolean }
  ) => {
    const res = await apiClient.get<APIResponse<any[]>>(
      `/admin/laboratories/${labId}/tests`,
      { params }
    );
    return res.data.data || [];
  },

  assignTestsToLaboratory: async (
    labId: string,
    testIds: string[],
    customPrice?: number
  ) => {
    const res = await apiClient.post<APIResponse<any>>(
      `/admin/laboratories/${labId}/tests/assign`,
      {
        test_ids: testIds,
        custom_price: customPrice,
      }
    );
    return res.data.data;
  },

  unassignTestsFromLaboratory: async (
    labId: string,
    testIds: string[]
  ) => {
    const res = await apiClient.post<APIResponse<any>>(
      `/admin/laboratories/${labId}/tests/unassign`,
      {
        test_ids: testIds,
      }
    );
    return res.data.data;
  },

  assignCommonTestsToLaboratory: async (labId: string) => {
    const res = await apiClient.post<APIResponse<any>>(
      `/admin/laboratories/${labId}/tests/assign-common`
    );
    return res.data.data;
  },

  updateLaboratoryTestAssignment: async (
    labId: string,
    testId: string,
    payload: { custom_price?: number; discount_percentage?: number; is_available?: boolean }
  ) => {
    const res = await apiClient.put<APIResponse<any>>(
      `/admin/laboratories/${labId}/tests/${testId}`,
      payload
    );
    return res.data.data;
  },
};

