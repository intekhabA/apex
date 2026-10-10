import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { PatientDashboardPage } from '@/features/patientPortal/PatientDashboardPage';
import { SuperAdminDashboardView } from './SuperAdminDashboardView';
import { LabAdminDashboardView } from './LabAdminDashboardView';
import { Card } from '@/components/ui';
import { ShieldAlert } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  if (user?.role === 'PATIENT') {
    return <PatientDashboardPage />;
  }

  if (user?.role === 'SUPER_ADMIN') {
    return <SuperAdminDashboardView />;
  }

  // Check if staff has dashboard permission
  if (!hasPermission('dashboard')) {
    // Redirect to first available functional module
    const modulesToCheck: [string, string][] = [
      ['bookings', '/bookings'],
      ['patients', '/patients'],
      ['samples', '/samples'],
      ['results', '/results'],
      ['reports', '/reports'],
      ['invoices', '/invoices'],
      ['expenses', '/expenses'],
      ['doctor_commissions', '/doctor-commissions'],
      ['tests', '/tests/catalog'],
      ['notifications', '/notifications'],
    ];

    for (const [permKey, routePath] of modulesToCheck) {
      if (hasPermission(permKey)) {
        return <Navigate to={routePath} replace />;
      }
    }

    return (
      <div className="max-w-lg mx-auto py-12">
        <Card className="p-8 text-center">
          <ShieldAlert className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
          <p className="text-sm text-slate-500 mt-2">
            You do not currently have permission to view the laboratory overview dashboard.
            Please contact your laboratory administrator to grant module access.
          </p>
        </Card>
      </div>
    );
  }

  return <LabAdminDashboardView />;
};

