import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types';

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

  const canManageLab = isSuperAdmin || isLabAdmin;
  const canEnterResults = isSuperAdmin || isLabAdmin || isLabAssistant || isPathologist;
  const canVerifyReports = isSuperAdmin || isLabAdmin || isPathologist || isRadiologist;
  const canAccessPhlebotomy = isSuperAdmin || isLabAdmin || isLabAssistant || isReceptionist;
  const canManageBilling = isSuperAdmin || isLabAdmin || isReceptionist;

  return {
    user,
    role,
    hasRole,
    isSuperAdmin,
    isLabAdmin,
    isPathologist,
    isRadiologist,
    isLabAssistant,
    isReceptionist,
    isPatient,
    isLabStaff,
    canManageLab,
    canEnterResults,
    canVerifyReports,
    canAccessPhlebotomy,
    canManageBilling,
  };
};
