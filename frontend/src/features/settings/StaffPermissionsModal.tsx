import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Pipette,
  FileSpreadsheet,
  FileCheck2,
  Receipt,
  Wallet,
  Percent,
  TestTubes,
  Bell,
  Shield,
  RotateCcw,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Modal, Button, Badge, Alert } from '@/components/ui';
import { labApi } from '@/api/labService';
import { UserResponse, PermissionModule } from '@/types';
import { ROLE_DEFAULT_PERMISSIONS } from '@/hooks/usePermissions';

// Map icon name to Lucide component
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  CalendarDays,
  Pipette,
  FileSpreadsheet,
  FileCheck2,
  Receipt,
  Wallet,
  Percent,
  TestTubes,
  Bell,
};

const DEFAULT_MODULES: PermissionModule[] = [
  {
    key: 'dashboard',
    name: 'Dashboard & Overview',
    description: 'View lab performance metrics, sample throughput, pending reports, and operational KPIs.',
    icon: 'LayoutDashboard',
  },
  {
    key: 'bookings',
    name: 'Bookings & Test Orders',
    description: 'Create appointments, schedule home visits, view booking list, and manage test orders.',
    icon: 'CalendarDays',
  },
  {
    key: 'patients',
    name: 'Patients Directory',
    description: 'Search, register, view patient medical profiles, demographics, and visit histories.',
    icon: 'Users',
  },
  {
    key: 'samples',
    name: 'Phlebotomy / Samples',
    description: 'Accession specimen collection, print tube barcodes, and manage phlebotomy worklists.',
    icon: 'Pipette',
  },
  {
    key: 'results',
    name: 'Results Entry (LFT/KFT/CBC)',
    description: 'Input diagnostic findings, parameter values, reference ranges, and technician notes.',
    icon: 'FileSpreadsheet',
  },
  {
    key: 'reports',
    name: 'Reports & Clinical Approvals',
    description: 'Review findings, medical sign-offs, doctor digital approvals, and print diagnostic reports.',
    icon: 'FileCheck2',
  },
  {
    key: 'invoices',
    name: 'Billing & Invoices',
    description: 'Generate invoices, record payments, calculate dues, discounts, and print money receipts.',
    icon: 'Receipt',
  },
  {
    key: 'expenses',
    name: 'Daily Expenses',
    description: 'Record clinic petty cash, supplier payments, lab expenses, and manage expense vouchers.',
    icon: 'Wallet',
  },
  {
    key: 'doctor_commissions',
    name: 'Doctor Referral Commissions',
    description: 'Track referring doctors, referral incentives, commissions ledger, and settlements.',
    icon: 'Percent',
  },
  {
    key: 'tests',
    name: 'Test Catalog & Pricing',
    description: 'Browse master laboratory test catalog, specimen requirements, and local lab pricing.',
    icon: 'TestTubes',
  },
  {
    key: 'notifications',
    name: 'Patient Alerts & SMS/WhatsApp',
    description: 'View dispatched SMS, WhatsApp message delivery status, and automated alert logs.',
    icon: 'Bell',
  },
];

export interface StaffPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffUser: UserResponse | null;
  onSuccess: () => void;
}

export const StaffPermissionsModal: React.FC<StaffPermissionsModalProps> = ({
  isOpen,
  onClose,
  staffUser,
  onSuccess,
}) => {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch module metadata and defaults from server (fallback to client defaults)
  const { data: moduleData } = useQuery({
    queryKey: ['permissionModules'],
    queryFn: labApi.getPermissionModules,
    staleTime: 1000 * 60 * 10,
  });

  const modules = moduleData?.modules || DEFAULT_MODULES;
  const roleDefaults = moduleData?.role_defaults || ROLE_DEFAULT_PERMISSIONS;

  // Initialize selected permissions when staffUser changes
  useEffect(() => {
    if (staffUser) {
      setErrorMessage(null);
      setSaveSuccess(false);

      if (staffUser.permissions && Array.isArray(staffUser.permissions)) {
        setSelectedPermissions(staffUser.permissions);
      } else {
        // Apply role defaults if no explicit permissions set
        const defaults = roleDefaults[staffUser.role] || [];
        setSelectedPermissions(defaults);
      }
    }
  }, [staffUser, roleDefaults]);

  const updatePermissionsMutation = useMutation({
    mutationFn: (perms: string[]) => {
      if (!staffUser) throw new Error('No staff user selected');
      return labApi.updateStaffPermissions(staffUser.id, perms);
    },
    onSuccess: () => {
      setSaveSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 700);
    },
    onError: (err: any) => {
      setErrorMessage(
        err?.response?.data?.message || err?.message || 'Failed to update access permissions'
      );
    },
  });

  if (!staffUser) return null;

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleSelectAll = () => {
    setSelectedPermissions(modules.map((m) => m.key));
  };

  const handleDeselectAll = () => {
    setSelectedPermissions([]);
  };

  const handleResetToDefaults = () => {
    const defaults = roleDefaults[staffUser.role] || [];
    setSelectedPermissions(defaults);
  };

  const handleSave = () => {
    setErrorMessage(null);
    updatePermissionsMutation.mutate(selectedPermissions);
  };

  const isRoleLabAdmin = staffUser.role === 'LAB_ADMIN';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Staff Feature Access & Permissions"
      description="Select which modules and features this team member is permitted to access."
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Staff User Header Card */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm">
              {staffUser.first_name[0]}
              {staffUser.last_name[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base">
                  {staffUser.first_name} {staffUser.last_name}
                </span>
                <Badge variant={staffUser.role === 'LAB_ADMIN' ? 'brand' : 'teal'}>
                  {staffUser.role}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{staffUser.email}</p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-semibold text-slate-500">
              Active Access:{' '}
              <span className="text-brand-700 font-bold">
                {selectedPermissions.length} of {modules.length}
              </span>{' '}
              modules
            </div>
          </div>
        </div>

        {isRoleLabAdmin && (
          <div className="flex items-start gap-2 bg-blue-50/70 border border-blue-200 text-blue-800 text-xs rounded-lg p-3">
            <Info className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
            <div>
              <strong>Administrator Account:</strong> Laboratory administrators maintain overarching access to lab configuration, staff roster, and audit logs by default.
            </div>
          </div>
        )}

        {errorMessage && (
          <Alert type="error" onDismiss={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}

        {saveSuccess && (
          <Alert type="success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Permissions saved and applied successfully!</span>
            </div>
          </Alert>
        )}

        {/* Quick Bulk Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-b border-slate-100 pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Available Modules
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 hover:bg-brand-50 px-2.5 py-1 rounded transition-colors"
            >
              Select All
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1 rounded transition-colors"
            >
              Deselect All
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1 rounded transition-colors flex items-center gap-1"
              title="Reset to recommended permissions for this role"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              Role Defaults
            </button>
          </div>
        </div>

        {/* Module Permissions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
          {modules.map((mod) => {
            const isChecked = selectedPermissions.includes(mod.key);
            const Icon = ICON_MAP[mod.icon] || Shield;

            return (
              <div
                key={mod.key}
                onClick={() => togglePermission(mod.key)}
                className={`relative flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'border-brand-300 bg-brand-50/40 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                {/* Icon Badge */}
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors mt-0.5 ${
                    isChecked
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={`text-sm font-bold truncate ${
                        isChecked ? 'text-brand-950' : 'text-slate-800'
                      }`}
                    >
                      {mod.name}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-0.5">
                    {mod.description}
                  </p>
                </div>

                {/* Checkbox indicator */}
                <div className="absolute top-3.5 right-3 text-brand-600">
                  {isChecked ? (
                    <div className="w-5 h-5 rounded-md bg-brand-600 text-white flex items-center justify-center shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-md border-2 border-slate-300 bg-white" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            Changes take effect immediately on next page navigation or login.
          </p>
          <div className="flex items-center gap-2.5">
            <Button variant="ghost" onClick={onClose} disabled={updatePermissionsMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              isLoading={updatePermissionsMutation.isPending}
              disabled={saveSuccess}
              leftIcon={<Shield className="w-4 h-4" />}
            >
              Save Permissions
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
