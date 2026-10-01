import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import {
  APIResponse,
  LoginCredentials,
  LoginSuccessData,
  TokenResponse,
  UserProfile,
  ChangePasswordPayload,
  MessageResponse,
} from '@/types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<LoginSuccessData> => {
    const res = await apiClient.post<APIResponse<LoginSuccessData>>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Login failed');
    }
    return res.data.data;
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const res = await apiClient.post<APIResponse<TokenResponse>>(
      API_ENDPOINTS.AUTH.REFRESH,
      { refresh_token: refreshToken }
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Token refresh failed');
    }
    return res.data.data;
  },

  getMe: async (): Promise<UserProfile> => {
    const res = await apiClient.get<APIResponse<UserProfile>>(API_ENDPOINTS.AUTH.ME);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch user profile');
    }
    return res.data.data;
  },

  changePassword: async (payload: ChangePasswordPayload): Promise<MessageResponse> => {
    const res = await apiClient.post<APIResponse<MessageResponse>>(
      API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
      payload
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update password');
    }
    return res.data.data;
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch {
      // Invalidate client side even if server call fails
    }
  },

  uploadSignature: async (file: File): Promise<UserProfile> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<APIResponse<UserProfile>>(
      API_ENDPOINTS.AUTH.SIGNATURE,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to upload signature');
    }
    return res.data.data;
  },

  deleteSignature: async (): Promise<UserProfile> => {
    const res = await apiClient.delete<APIResponse<UserProfile>>(API_ENDPOINTS.AUTH.SIGNATURE);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to remove signature');
    }
    return res.data.data;
  },
};

