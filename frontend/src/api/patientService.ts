import { apiClient } from './client';
import { APIResponse, Patient, PatientCreatePayload, TimelineEvent } from '@/types';

export const patientService = {
  async getPatients(search?: string): Promise<Patient[]> {
    const res = await apiClient.get<APIResponse<Patient[]>>('/patients', {
      params: { search },
    });
    return res.data.data || [];
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
