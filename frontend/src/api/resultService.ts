import { apiClient } from './client';
import {
  APIResponse,
  PaginatedResponse,
  PendingWorklistReport,
  ResultSheetResponse,
  ResultEntryPayload,
} from '@/types';

export interface ResultsPendingParams {
  search?: string;
  page?: number;
  limit?: number;
  all?: boolean;
}

export const resultService = {
  async getPendingWorklist(
    params?: ResultsPendingParams
  ): Promise<PaginatedResponse<PendingWorklistReport>> {
    const res = await apiClient.get<APIResponse<PendingWorklistReport[]>>('/results/pending', {
      params,
    });
    const items = res.data.data || [];
    const meta = res.data.meta || {
      page: params?.page || 1,
      limit: params?.limit || items.length || 20,
      total: items.length,
      total_pages: 1,
    };
    return { items, meta };
  },

  async getResultSheet(reportId: string): Promise<ResultSheetResponse> {
    const res = await apiClient.get<APIResponse<ResultSheetResponse>>(`/results/${reportId}`);
    return res.data.data!;
  },

  async saveResultValues(
    reportId: string,
    payload: ResultEntryPayload
  ): Promise<ResultSheetResponse> {
    const res = await apiClient.put<APIResponse<ResultSheetResponse>>(
      `/results/${reportId}/values`,
      payload
    );
    return res.data.data!;
  },
};
