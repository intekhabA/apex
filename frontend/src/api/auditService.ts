import { apiClient } from './client';
import { APIResponse } from '@/types/api';
import { AuditLog, AuditLogFilterParams } from '@/types/audit';

export const auditService = {
  async getAuditLogs(params?: AuditLogFilterParams): Promise<AuditLog[]> {
    const res = await apiClient.get<APIResponse<AuditLog[]>>('/audit/logs', { params });
    return res.data.data || [];
  },
};
