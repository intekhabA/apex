import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import {
  APIResponse,
  Doctor,
  DoctorCreatePayload,
  DoctorTestCommissionItem,
  DoctorCommissionReport,
} from '@/types';

export const doctorService = {
  getDoctors: async (search?: string, isActive?: boolean): Promise<Doctor[]> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (isActive !== undefined) params.append('is_active', String(isActive));

    const response = await apiClient.get<APIResponse<Doctor[]>>(
      `${API_ENDPOINTS.DOCTORS.BASE}?${params.toString()}`
    );
    return response.data.data || [];
  },

  createDoctor: async (payload: DoctorCreatePayload): Promise<Doctor> => {
    const response = await apiClient.post<APIResponse<Doctor>>(
      API_ENDPOINTS.DOCTORS.BASE,
      payload
    );
    return response.data.data!;
  },

  updateDoctor: async (doctorId: string, payload: Partial<DoctorCreatePayload>): Promise<Doctor> => {
    const response = await apiClient.put<APIResponse<Doctor>>(
      `${API_ENDPOINTS.DOCTORS.BASE}/${doctorId}`,
      payload
    );
    return response.data.data!;
  },

  deleteDoctor: async (doctorId: string): Promise<void> => {
    await apiClient.delete(`${API_ENDPOINTS.DOCTORS.BASE}/${doctorId}`);
  },

  getDoctorTestCommissions: async (doctorId: string): Promise<DoctorTestCommissionItem[]> => {
    const response = await apiClient.get<APIResponse<DoctorTestCommissionItem[]>>(
      API_ENDPOINTS.DOCTORS.COMMISSIONS(doctorId)
    );
    return response.data.data || [];
  },

  saveDoctorTestCommissions: async (
    doctorId: string,
    commissions: Array<{ test_id: string; commission_percentage: number }>
  ): Promise<void> => {
    await apiClient.put(API_ENDPOINTS.DOCTORS.COMMISSIONS(doctorId), {
      commissions,
    });
  },

  getCommissionReport: async (params: {
    period: 'daily' | 'monthly' | 'custom';
    date?: string;
    month?: string;
    start_date?: string;
    end_date?: string;
    doctor_id?: string;
  }): Promise<DoctorCommissionReport> => {
    const query = new URLSearchParams();
    query.append('period', params.period);
    if (params.date) query.append('date', params.date);
    if (params.month) query.append('month', params.month);
    if (params.start_date) query.append('start_date', params.start_date);
    if (params.end_date) query.append('end_date', params.end_date);
    if (params.doctor_id) query.append('doctor_id', params.doctor_id);

    const response = await apiClient.get<APIResponse<DoctorCommissionReport>>(
      `${API_ENDPOINTS.COMMISSIONS.REPORT}?${query.toString()}`
    );
    return response.data.data!;
  },
};
