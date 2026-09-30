import { apiClient } from './client';
import { API_ENDPOINTS } from './endpoints';
import {
  APIResponse,
  TestCategory,
  DiagnosticTest,
  LabTestPriceOverride,
  TestPackage,
} from '@/types';

export const testService = {
  // Categories
  async getCategories(): Promise<TestCategory[]> {
    const res = await apiClient.get<APIResponse<TestCategory[]>>(API_ENDPOINTS.TESTS.CATEGORIES);
    return res.data.data || [];
  },

  async createCategory(payload: {
    code: string;
    name: string;
    description?: string;
    display_order?: number;
    is_active?: boolean;
  }): Promise<TestCategory> {
    const res = await apiClient.post<APIResponse<TestCategory>>(
      API_ENDPOINTS.TESTS.CATEGORIES,
      payload
    );
    return res.data.data!;
  },

  // Master Tests
  async getTests(params?: { category_id?: string; search?: string }): Promise<DiagnosticTest[]> {
    const res = await apiClient.get<APIResponse<DiagnosticTest[]>>(API_ENDPOINTS.TESTS.TESTS, {
      params,
    });
    return res.data.data || [];
  },

  async getTestById(id: string): Promise<DiagnosticTest> {
    const res = await apiClient.get<APIResponse<DiagnosticTest>>(`${API_ENDPOINTS.TESTS.TESTS}/${id}`);
    return res.data.data!;
  },

  async createTest(payload: any): Promise<DiagnosticTest> {
    const res = await apiClient.post<APIResponse<DiagnosticTest>>(
      API_ENDPOINTS.TESTS.TESTS,
      payload
    );
    return res.data.data!;
  },

  async updateTest(id: string, payload: any): Promise<DiagnosticTest> {
    const res = await apiClient.put<APIResponse<DiagnosticTest>>(
      `${API_ENDPOINTS.TESTS.TESTS}/${id}`,
      payload
    );
    return res.data.data!;
  },

  // Lab Pricing Overrides
  async getPricingOverrides(): Promise<LabTestPriceOverride[]> {
    const res = await apiClient.get<APIResponse<LabTestPriceOverride[]>>(
      `${API_ENDPOINTS.TESTS.TESTS}/pricing/overrides`
    );
    return res.data.data || [];
  },

  async setPriceOverride(payload: {
    test_id: string;
    custom_price: number;
    discount_percentage?: number;
    is_available?: boolean;
  }): Promise<LabTestPriceOverride> {
    const res = await apiClient.put<APIResponse<LabTestPriceOverride>>(
      `${API_ENDPOINTS.TESTS.TESTS}/pricing/override`,
      payload
    );
    return res.data.data!;
  },

  async removePriceOverride(testId: string): Promise<void> {
    await apiClient.delete(`${API_ENDPOINTS.TESTS.TESTS}/pricing/override/${testId}`);
  },

  // Packages
  async getPackages(): Promise<TestPackage[]> {
    const res = await apiClient.get<APIResponse<TestPackage[]>>(API_ENDPOINTS.TESTS.PACKAGES);
    return res.data.data || [];
  },

  async createPackage(payload: {
    code: string;
    name: string;
    description?: string;
    price: number;
    discount_percentage?: number;
    test_ids: string[];
  }): Promise<TestPackage> {
    const res = await apiClient.post<APIResponse<TestPackage>>(
      API_ENDPOINTS.TESTS.PACKAGES,
      payload
    );
    return res.data.data!;
  },
};
