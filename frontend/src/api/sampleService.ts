import { apiClient } from './client';
import {
  APIResponse,
  PaginatedResponse,
  SpecimenSample,
  SampleStatus,
  SampleTrackingEvent,
} from '@/types';

export interface SampleQueryParams {
  status?: SampleStatus;
  booking_id?: string;
  patient_id?: string;
  search?: string;
  page?: number;
  limit?: number;
  all?: boolean;
}

export const sampleService = {
  async getSamples(params?: SampleQueryParams): Promise<PaginatedResponse<SpecimenSample>> {
    const res = await apiClient.get<APIResponse<SpecimenSample[]>>('/samples', { params });
    const items = res.data.data || [];
    const meta = res.data.meta || {
      page: params?.page || 1,
      limit: params?.limit || items.length || 20,
      total: items.length,
      total_pages: 1,
    };
    return { items, meta };
  },

  async collectSample(payload: {
    sample_id: string;
    sample_container?: string;
    barcode_value?: string;
    remarks?: string;
  }): Promise<SpecimenSample> {
    const res = await apiClient.post<APIResponse<SpecimenSample>>('/samples/collect', payload);
    return res.data.data!;
  },

  async receiveSample(payload: { sample_id: string; remarks?: string }): Promise<SpecimenSample> {
    const res = await apiClient.post<APIResponse<SpecimenSample>>('/samples/receive', payload);
    return res.data.data!;
  },

  async rejectSample(payload: {
    sample_id: string;
    rejection_reason: string;
    remarks?: string;
  }): Promise<SpecimenSample> {
    const res = await apiClient.post<APIResponse<SpecimenSample>>('/samples/reject', payload);
    return res.data.data!;
  },

  async getSampleHistory(sampleId: string): Promise<SampleTrackingEvent[]> {
    const res = await apiClient.get<APIResponse<SampleTrackingEvent[]>>(
      `/samples/${sampleId}/history`
    );
    return res.data.data || [];
  },
};
