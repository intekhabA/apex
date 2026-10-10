import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';
import { LoadingSpinner } from './LoadingSpinner';

export interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requiredPermission,
}) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const { hasPermission } = usePermissions();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner size="lg" label="Verifying session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
