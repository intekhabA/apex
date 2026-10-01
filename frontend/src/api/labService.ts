import { apiClient } from './client';
import {
  APIResponse,
  Laboratory,
  LaboratoryUpdatePayload,
  LaboratorySettings,
  LaboratorySettingsUpdatePayload,
  UserResponse,
  UserCreatePayload,
  UserUpdatePayload,
} from '@/types';

export const labApi = {
  getProfile: async (): Promise<Laboratory> => {
    const res = await apiClient.get<APIResponse<Laboratory>>('/lab/profile');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch laboratory profile');
    }
    return res.data.data;
  },

  updateProfile: async (payload: LaboratoryUpdatePayload): Promise<Laboratory> => {
    const res = await apiClient.put<APIResponse<Laboratory>>('/lab/profile', payload);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update laboratory profile');
    }
    return res.data.data;
  },

  getSettings: async (): Promise<LaboratorySettings> => {
    const res = await apiClient.get<APIResponse<LaboratorySettings>>('/lab/settings');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch laboratory settings');
    }
    return res.data.data;
  },

  updateSettings: async (payload: LaboratorySettingsUpdatePayload): Promise<LaboratorySettings> => {
    const res = await apiClient.put<APIResponse<LaboratorySettings>>('/lab/settings', payload);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update laboratory settings');
    }
    return res.data.data;
  },

  listStaff: async (): Promise<UserResponse[]> => {
    const res = await apiClient.get<APIResponse<UserResponse[]>>('/lab/users');
    return res.data.data || [];
  },

  createStaff: async (payload: UserCreatePayload): Promise<UserResponse> => {
    const res = await apiClient.post<APIResponse<UserResponse>>('/lab/users', payload);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to provision staff member');
    }
    return res.data.data;
  },

  getStaffMember: async (userId: string): Promise<UserResponse> => {
    const res = await apiClient.get<APIResponse<UserResponse>>(`/lab/users/${userId}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch staff member');
    }
    return res.data.data;
  },

  updateStaffMember: async (
    userId: string,
    payload: UserUpdatePayload
  ): Promise<UserResponse> => {
    const res = await apiClient.put<APIResponse<UserResponse>>(`/lab/users/${userId}`, payload);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update staff member');
    }
    return res.data.data;
  },

  updateStaffStatus: async (userId: string, isActive: boolean): Promise<UserResponse> => {
    const res = await apiClient.patch<APIResponse<UserResponse>>(`/lab/users/${userId}/status`, {
      is_active: isActive,
    });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update staff status');
    }
    return res.data.data;
  },

  uploadSignature: async (file: File): Promise<LaboratorySettings> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<APIResponse<LaboratorySettings>>(
      '/lab/signature',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to upload laboratory signatory signature');
    }
    return res.data.data;
  },

  deleteSignature: async (): Promise<LaboratorySettings> => {
    const res = await apiClient.delete<APIResponse<LaboratorySettings>>('/lab/signature');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to remove signatory signature');
    }
    return res.data.data;
  },
};

