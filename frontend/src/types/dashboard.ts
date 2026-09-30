import { Booking } from './booking';
import { ReportListItem } from './report';

export interface DailyTrendPoint {
  date: string;
  bookings: number;
  revenue: number | string;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface LabDashboardData {
  today_bookings_count: number;
  total_bookings_count: number;
  samples_pending_collection: number;
  samples_in_lab: number;
  reports_draft: number;
  reports_completed: number;
  revenue_today: number | string;
  revenue_total: number | string;
  outstanding_receivables: number | string;
  sample_status_breakdown: StatusCount[];
  report_status_breakdown: StatusCount[];
  daily_trends: DailyTrendPoint[];
  recent_bookings: Booking[];
  recent_reports: ReportListItem[];
}

export interface LabPerformanceMetric {
  lab_id: string;
  lab_name: string;
  lab_code: string;
  is_active: boolean;
  total_bookings: number;
  total_revenue: number | string;
}

export interface CategoryDistribution {
  category_name: string;
  test_count: number;
}

export interface SuperAdminDashboardData {
  total_laboratories: number;
  active_laboratories: number;
  total_users: number;
  total_patients: number;
  total_tests: number;
  total_bookings: number;
  total_revenue: number | string;
  total_reports_completed: number;
  lab_performance: LabPerformanceMetric[];
  category_distribution: CategoryDistribution[];
  daily_trends: DailyTrendPoint[];
}
