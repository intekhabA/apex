import { apiClient } from './client';
import { APIResponse, PaginatedResponse, Patient, PatientCreatePayload, TimelineEvent } from '@/types';

export interface PatientQueryParams {
  search?: string;
  page?: number;
  limit?: number;
  all?: boolean;
}

export const patientService = {
  async getPatients(
    params?: string | PatientQueryParams
  ): Promise<PaginatedResponse<Patient>> {
    const queryParams = typeof params === 'string' ? { search: params } : params;
    const res = await apiClient.get<APIResponse<Patient[]>>('/patients', {
      params: queryParams,
    });
    const items = res.data.data || [];
    const meta = res.data.meta || {
      page: queryParams?.page || 1,
      limit: queryParams?.limit || items.length || 20,
      total: items.length,
      total_pages: 1,
    };
    return { items, meta };
  },

  async getPatientById(id: string): Promise<Patient> {
    const res = await apiClient.get<APIResponse<Patient>>(`/patients/${id}`);
    return res.data.data!;
  },

  async createPatient(payload: PatientCreatePayload): Promise<Patient> {
    const res = await apiClient.post<APIResponse<Patient>>('/patients', payload);
    return res.data.data!;
  },

  async updatePatient(id: string, payload: Partial<PatientCreatePayload>): Promise<Patient> {
    const res = await apiClient.put<APIResponse<Patient>>(`/patients/${id}`, payload);
    return res.data.data!;
  },

  async getPatientTimeline(id: string): Promise<TimelineEvent[]> {
    const res = await apiClient.get<APIResponse<TimelineEvent[]>>(`/patients/${id}/timeline`);
    return res.data.data || [];
  },
};
