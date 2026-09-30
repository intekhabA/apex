export type TestType = 'PATHOLOGY' | 'BIOCHEMISTRY' | 'RADIOLOGY' | 'CARDIOLOGY' | 'OTHER';

export type SampleType =
  | 'WHOLE_BLOOD_EDTA'
  | 'SERUM'
  | 'PLASMA_CITRATE'
  | 'URINE_ROUTINE'
  | 'URINE_24HR'
  | 'STOOL'
  | 'CSF'
  | 'SWAB'
  | 'IMAGING'
  | 'OTHER';

export type ResultValueType = 'NUMBER' | 'TEXT' | 'SELECT' | 'FORMULA' | 'MULTILINE_TEXT';

export interface TestCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReferenceRange {
  id: string;
  parameter_id: string;
  gender?: 'MALE' | 'FEMALE' | null;
  age_min_years: number;
  age_max_years: number;
  min_value?: number | null;
  max_value?: number | null;
  critical_low?: number | null;
  critical_high?: number | null;
  text_normal_value?: string | null;
  display_range_string: string;
}

export interface TestParameter {
  id: string;
  test_id: string;
  code: string;
  name: string;
  short_name?: string;
  unit?: string;
  result_type: ResultValueType;
  decimal_precision: number;
  display_order: number;
  options_json?: any;
  reference_ranges: ReferenceRange[];
}

export interface DiagnosticTest {
  id: string;
  category_id: string;
  category_name?: string;
  code: string;
  name: string;
  short_name?: string;
  test_type: TestType;
  sample_type: SampleType;
  sample_container?: string;
  preparation_instructions?: string;
  turnaround_hours: number;
  default_price: number;
  effective_price?: number;
  is_active: boolean;
  parameters: TestParameter[];
  created_at: string;
  updated_at: string;
}

export interface LabTestPriceOverride {
  id: string;
  lab_id: string;
  test_id: string;
  custom_price: number;
  discount_percentage: number;
  is_available: boolean;
  created_at: string;
}

export interface TestPackageItem {
  test_id: string;
  test_name?: string;
  test_code?: string;
  test_price?: number;
}

export interface TestPackage {
  id: string;
  code: string;
  name: string;
  description?: string;
  price: number;
  discount_percentage: number;
  is_active: boolean;
  items: TestPackageItem[];
  created_at: string;
}
