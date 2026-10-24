import { apiClient } from './client';
import { APIResponse, PaginatedResponse } from '@/types/api';
import { AuditLog, AuditLogFilterParams } from '@/types/audit';

export interface AuditLogQueryParams extends AuditLogFilterParams {
  page?: number;
  all?: boolean;
}

export const auditService = {
  async getAuditLogs(params?: AuditLogQueryParams): Promise<PaginatedResponse<AuditLog>> {
    const res = await apiClient.get<APIResponse<AuditLog[]>>('/audit/logs', { params });
    const items = res.data.data || [];
    const meta = res.data.meta || {
      page: params?.page || 1,
      limit: params?.limit || items.length || 20,
      total: items.length,
      total_pages: 1,
    };
    return { items, meta };
  },
};
