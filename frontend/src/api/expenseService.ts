import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import {
  APIResponse,
  Expense,
  ExpenseCreateInput,
  ExpenseUpdateInput,
  ExpenseSummary,
  ExpensePeriodType,
  CategoryPresetItem,
} from '@/types';

export interface ExpenseQueryParams {
  period?: ExpensePeriodType;
  date?: string;
  month?: string;
  start_date?: string;
  end_date?: string;
  category?: string;
  payment_method?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const expenseService = {
  getExpenses: async (params?: ExpenseQueryParams): Promise<{ items: Expense[]; total: number }> => {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    if (params?.date) query.append('date', params.date);
    if (params?.month) query.append('month', params.month);
    if (params?.start_date) query.append('start_date', params.start_date);
    if (params?.end_date) query.append('end_date', params.end_date);
    if (params?.category) query.append('category', params.category);
    if (params?.payment_method) query.append('payment_method', params.payment_method);
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const response = await apiClient.get<APIResponse<Expense[]>>(
      `${API_ENDPOINTS.EXPENSES.BASE}?${query.toString()}`
    );
    return {
      items: response.data.data || [],
      total: response.data.meta?.total || (response.data.data || []).length,
    };
  },

  getExpenseSummary: async (params: {
    period: ExpensePeriodType;
    date?: string;
    month?: string;
    start_date?: string;
    end_date?: string;
    category?: string;
    payment_method?: string;
    search?: string;
  }): Promise<ExpenseSummary> => {
    const query = new URLSearchParams();
    query.append('period', params.period);
    if (params.date) query.append('date', params.date);
    if (params.month) query.append('month', params.month);
    if (params.start_date) query.append('start_date', params.start_date);
    if (params.end_date) query.append('end_date', params.end_date);
    if (params.category) query.append('category', params.category);
    if (params.payment_method) query.append('payment_method', params.payment_method);
    if (params.search) query.append('search', params.search);

    const response = await apiClient.get<APIResponse<ExpenseSummary>>(
      `${API_ENDPOINTS.EXPENSES.SUMMARY}?${query.toString()}`
    );
    return response.data.data!;
  },

  getCategoryPresets: async (): Promise<CategoryPresetItem[]> => {
    const response = await apiClient.get<APIResponse<CategoryPresetItem[]>>(
      API_ENDPOINTS.EXPENSES.PRESETS
    );
    return response.data.data || [];
  },

  createExpense: async (payload: ExpenseCreateInput): Promise<Expense> => {
    const response = await apiClient.post<APIResponse<Expense>>(
      API_ENDPOINTS.EXPENSES.BASE,
      payload
    );
    return response.data.data!;
  },

  getExpenseDetail: async (id: string): Promise<Expense> => {
    const response = await apiClient.get<APIResponse<Expense>>(
      API_ENDPOINTS.EXPENSES.DETAIL(id)
    );
    return response.data.data!;
  },

  updateExpense: async (id: string, payload: ExpenseUpdateInput): Promise<Expense> => {
    const response = await apiClient.put<APIResponse<Expense>>(
      API_ENDPOINTS.EXPENSES.DETAIL(id),
      payload
    );
    return response.data.data!;
  },

  deleteExpense: async (id: string): Promise<void> => {
    await apiClient.delete(API_ENDPOINTS.EXPENSES.DETAIL(id));
  },
};
