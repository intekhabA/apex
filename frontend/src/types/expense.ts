export type ExpensePeriodType = 'daily' | 'monthly' | 'custom';

export interface Expense {
  id: string;
  lab_id: string;
  title: string;
  category: string;
  amount: number | string;
  expense_date: string; // YYYY-MM-DD
  payment_method: string;
  vendor_name?: string | null;
  receipt_number?: string | null;
  notes?: string | null;
  created_by_id?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCreateInput {
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  vendor_name?: string;
  receipt_number?: string;
  notes?: string;
}

export interface ExpenseUpdateInput {
  title?: string;
  category?: string;
  amount?: number;
  expense_date?: string;
  payment_method?: string;
  vendor_name?: string;
  receipt_number?: string;
  notes?: string;
}

export interface CategoryBreakdownItem {
  category: string;
  category_label: string;
  total_amount: number | string;
  percentage: number;
  count: number;
}

export interface PaymentMethodBreakdownItem {
  payment_method: string;
  total_amount: number | string;
  count: number;
}

export interface DailyBreakdownItem {
  date: string;
  total_amount: number | string;
  count: number;
}

export interface ExpenseSummary {
  period: ExpensePeriodType;
  start_date: string;
  end_date: string;
  total_amount: number | string;
  expense_count: number;
  average_expense: number | string;
  categories_breakdown: CategoryBreakdownItem[];
  payment_methods_breakdown: PaymentMethodBreakdownItem[];
  daily_breakdown: DailyBreakdownItem[];
  expenses: Expense[];
}

export interface CategoryPresetItem {
  key: string;
  label: string;
  description?: string;
}
