import { apiClient } from './client';
import {
  APIResponse,
  PlatformSEOSettings,
  PlatformSEOSettingsUpdatePayload,
  PublicSEOMetadata,
} from '@/types';

export const seoApi = {
  getPublicSEO: async (): Promise<PublicSEOMetadata> => {
    const res = await apiClient.get<APIResponse<PublicSEOMetadata>>('/seo/public');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch public SEO metadata');
    }
    return res.data.data;
  },

  getAdminSEO: async (): Promise<PlatformSEOSettings> => {
    const res = await apiClient.get<APIResponse<PlatformSEOSettings>>('/admin/seo');
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to fetch admin SEO configuration');
    }
    return res.data.data;
  },

  updateAdminSEO: async (payload: PlatformSEOSettingsUpdatePayload): Promise<PlatformSEOSettings> => {
    const res = await apiClient.put<APIResponse<PlatformSEOSettings>>('/admin/seo', payload);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || 'Failed to update SEO configuration');
    }
    return res.data.data;
  },
};
