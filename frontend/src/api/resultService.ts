import { apiClient } from './client';
import {
  APIResponse,
  PendingWorklistReport,
  ResultSheetResponse,
  ResultEntryPayload,
} from '@/types';

export const resultService = {
  async getPendingWorklist(): Promise<PendingWorklistReport[]> {
    const res = await apiClient.get<APIResponse<PendingWorklistReport[]>>('/results/pending');
    return res.data.data || [];
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
