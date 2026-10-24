import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import {
  APIResponse,
  PaginatedResponse,
  Doctor,
  DoctorCreatePayload,
  DoctorTestCommissionItem,
  DoctorCommissionReport,
} from '@/types';

export interface DoctorQueryParams {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  all?: boolean;
}

export const doctorService = {
  getDoctors: async (
    params?: string | DoctorQueryParams,
    isActive?: boolean
  ): Promise<PaginatedResponse<Doctor>> => {
    let search: string | undefined;
    let active: boolean | undefined = isActive;
    let page: number | undefined;
    let limit: number | undefined;
    let all: boolean | undefined;

    if (typeof params === 'string') {
      search = params;
    } else if (params) {
      search = params.search;
      active = params.isActive ?? active;
      page = params.page;
      limit = params.limit;
      all = params.all;
    }

    const queryParams: Record<string, any> = {};
    if (search) queryParams.search = search;
    if (active !== undefined) queryParams.is_active = active;
    if (page) queryParams.page = page;
    if (limit) queryParams.limit = limit;
    if (all) queryParams.all = all;

    const response = await apiClient.get<APIResponse<Doctor[]>>(API_ENDPOINTS.DOCTORS.BASE, {
      params: queryParams,
    });
    const items = response.data.data || [];
    const meta = response.data.meta || {
      page: page || 1,
      limit: limit || items.length || 20,
      total: items.length,
      total_pages: 1,
    };
    return { items, meta };
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
