import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProfilePage } from '@/features/auth/ProfilePage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { UnauthorizedPage } from '@/features/auth/UnauthorizedPage';
import { NotFoundPage } from '@/features/common/NotFoundPage';
import { LabsListPage } from '@/features/superadmin/LabsListPage';
import { StaffManagementPage } from '@/features/settings/StaffManagementPage';
import { LabProfilePage } from '@/features/settings/LabProfilePage';
import { ReportSettingsPage } from '@/features/settings/ReportSettingsPage';
import { TestCatalogPage } from '@/features/tests/TestCatalogPage';
import { PatientsPage } from '@/features/patients/PatientsPage';
import { BookingsPage } from '@/features/bookings/BookingsPage';
import { PhlebotomyWorklistPage } from '@/features/samples/PhlebotomyWorklistPage';
import { ResultsWorklistPage } from '@/features/results/ResultsWorklistPage';
import { ReportsListPage } from '@/features/reports/ReportsListPage';
import { InvoicesListPage } from '@/features/invoices/InvoicesListPage';
import {
  PatientDashboardPage,
  PatientReportsPage,
  PatientBookingsPage,
  PatientInvoicesPage,
} from '@/features/patientPortal';
import { PublicVerificationPage } from '@/features/reports/PublicVerificationPage';
import { AuditLogPage } from '@/features/audit/AuditLogPage';
import { NotificationsLogPage } from '@/features/notifications/NotificationsLogPage';
import { DoctorCommissionsPage } from '@/features/commissions/DoctorCommissionsPage';
import { DailyExpensesPage } from '@/features/expenses';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Auth & Verification Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="/verify/:token" element={<PublicVerificationPage />} />

          {/* Authenticated Core Workstation Routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/tests/catalog"
              element={
                <ProtectedRoute requiredPermission="tests">
                  <TestCatalogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patients"
              element={
                <ProtectedRoute requiredPermission="patients">
                  <PatientsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bookings"
              element={
                <ProtectedRoute requiredPermission="bookings">
                  <BookingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/samples"
              element={
                <ProtectedRoute requiredPermission="samples">
                  <PhlebotomyWorklistPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/results"
              element={
                <ProtectedRoute requiredPermission="results">
                  <ResultsWorklistPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute requiredPermission="reports">
                  <ReportsListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/invoices"
              element={
                <ProtectedRoute requiredPermission="invoices">
                  <InvoicesListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <ProtectedRoute requiredPermission="expenses">
                  <DailyExpensesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor-commissions"
              element={
                <ProtectedRoute requiredPermission="doctor_commissions">
                  <DoctorCommissionsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/patient/dashboard" element={<PatientDashboardPage />} />
            <Route path="/patient/reports" element={<PatientReportsPage />} />
            <Route path="/patient/bookings" element={<PatientBookingsPage />} />
            <Route path="/patient/invoices" element={<PatientInvoicesPage />} />

            {/* Super Admin Routes */}
            <Route
              path="/admin/laboratories"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <LabsListPage />
                </ProtectedRoute>
              }
            />

            {/* Laboratory Settings & Staff Routes */}
            <Route
              path="/settings/staff"
              element={
                <ProtectedRoute allowedRoles={['LAB_ADMIN', 'SUPER_ADMIN']}>
                  <StaffManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/lab"
              element={
                <ProtectedRoute allowedRoles={['LAB_ADMIN', 'SUPER_ADMIN']}>
                  <LabProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/reports"
              element={
                <ProtectedRoute allowedRoles={['LAB_ADMIN', 'SUPER_ADMIN']}>
                  <ReportSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Audit & Compliance Routes */}
            <Route
              path="/audit/logs"
              element={
                <ProtectedRoute allowedRoles={['LAB_ADMIN', 'SUPER_ADMIN']}>
                  <AuditLogPage />
                </ProtectedRoute>
              }
            />

            {/* Notification & Dispatch History Routes */}
            <Route
              path="/notifications"
              element={
                <ProtectedRoute requiredPermission="notifications">
                  <NotificationsLogPage />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>

          {/* Catch-all 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
