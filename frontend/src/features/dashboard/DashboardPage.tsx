import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PatientDashboardPage } from '@/features/patientPortal/PatientDashboardPage';
import { SuperAdminDashboardView } from './SuperAdminDashboardView';
import { LabAdminDashboardView } from './LabAdminDashboardView';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();

  if (user?.role === 'PATIENT') {
    return <PatientDashboardPage />;
  }

  if (user?.role === 'SUPER_ADMIN') {
    return <SuperAdminDashboardView />;
  }

  return <LabAdminDashboardView />;
};
