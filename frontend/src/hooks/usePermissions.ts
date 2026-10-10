import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';

export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    'dashboard',
    'patients',
    'bookings',
    'samples',
    'results',
    'reports',
    'invoices',
    'expenses',
    'doctor_commissions',
    'tests',
    'notifications',
  ],
  LAB_ADMIN: [
    'dashboard',
    'patients',
    'bookings',
    'samples',
    'results',
    'reports',
    'invoices',
    'expenses',
    'doctor_commissions',
    'tests',
    'notifications',
  ],
  RECEPTIONIST: [
    'dashboard',
    'patients',
    'bookings',
    'samples',
    'invoices',
    'expenses',
    'notifications',
  ],
  LAB_ASSISTANT: ['patients', 'samples', 'results', 'expenses'],
  PATHOLOGIST: ['results', 'reports', 'tests'],
  RADIOLOGIST: ['results', 'reports', 'tests'],
  PATIENT: [],
};

export const usePermissions = () => {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;

  const hasRole = (allowedRoles: UserRole[]): boolean => {
    if (!role) return false;
    return allowedRoles.includes(role);
  };

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isLabAdmin = role === 'LAB_ADMIN';
  const isPathologist = role === 'PATHOLOGIST';
  const isRadiologist = role === 'RADIOLOGIST';
  const isLabAssistant = role === 'LAB_ASSISTANT';
  const isReceptionist = role === 'RECEPTIONIST';
  const isPatient = role === 'PATIENT';

  const isLabStaff = [
    'SUPER_ADMIN',
    'LAB_ADMIN',
    'LAB_ASSISTANT',
    'PATHOLOGIST',
    'RADIOLOGIST',
    'RECEPTIONIST',
  ].includes(role || '');

  const hasPermission = (permissionKey: string): boolean => {
    if (!role) return false;
    if (isSuperAdmin || isLabAdmin) return true;
    if (user?.permissions && Array.isArray(user.permissions)) {
      return user.permissions.includes(permissionKey);
    }
    const defaults = ROLE_DEFAULT_PERMISSIONS[role] || [];
    return defaults.includes(permissionKey);
  };

  const canManageLab = isSuperAdmin || isLabAdmin;
  const canAccessDashboard = hasPermission('dashboard');
  const canAccessBookings = hasPermission('bookings');
  const canAccessPatients = hasPermission('patients');
  const canAccessPhlebotomy = hasPermission('samples');
  const canEnterResults = hasPermission('results');
  const canVerifyReports = hasPermission('reports');
  const canManageBilling = hasPermission('invoices');
  const canAccessExpenses = hasPermission('expenses');
  const canAccessDoctorCommissions = hasPermission('doctor_commissions');
  const canAccessTests = hasPermission('tests');
  const canAccessNotifications = hasPermission('notifications');

  return {
    user,
    role,
    hasRole,
    hasPermission,
    isSuperAdmin,
    isLabAdmin,
    isPathologist,
    isRadiologist,
    isLabAssistant,
    isReceptionist,
    isPatient,
    isLabStaff,
    canManageLab,
    canAccessDashboard,
    canAccessBookings,
    canAccessPatients,
    canAccessPhlebotomy,
    canEnterResults,
    canVerifyReports,
    canManageBilling,
    canAccessExpenses,
    canAccessDoctorCommissions,
    canAccessTests,
    canAccessNotifications,
  };
};
