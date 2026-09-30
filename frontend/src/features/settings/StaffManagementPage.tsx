import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Search, Power, Mail, FileBadge } from 'lucide-react';
import { labApi } from '@/api/labService';
import { useAuthStore } from '@/store/authStore';
import { Button, Input, Badge, Card, LoadingSpinner } from '@/components/ui';
import { AddStaffModal } from './AddStaffModal';


export const StaffManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['labStaffList'],
    queryFn: labApi.listStaff,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      labApi.updateStaffStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labStaffList'] });
    },
  });

  const filteredStaff = staff.filter((u) => {
    const term = searchTerm.toLowerCase();
    const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
    return (
      fullName.includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'LAB_ADMIN':
        return 'brand';
      case 'PATHOLOGIST':
      case 'RADIOLOGIST':
        return 'teal';
      default:
        return 'slate';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-brand-600" />
            Staff & Clinical Team Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage workstation access, roles, and digital signatory credentials for your team.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddModalOpen(true)}
        >
          Provision New Staff
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search staff by name, email, or role..."
            leftIcon={<Search className="w-4 h-4" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Total Members: <strong className="text-slate-800">{staff.length}</strong>
        </div>
      </div>

      {/* Staff Table */}
      <Card>
        {isLoading ? (
          <LoadingSpinner size="lg" label="Loading staff roster..." />
        ) : filteredStaff.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 text-base">No staff members found</h3>
            <p className="text-slate-400 text-sm mt-1">
              Add pathologists, technicians, or receptionists to your laboratory.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-6">Staff Member</th>
                  <th className="py-3.5 px-6">Work Role</th>
                  <th className="py-3.5 px-6">Medical License</th>
                  <th className="py-3.5 px-6">Contact Phone</th>
                  <th className="py-3.5 px-6">Account Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div>
                          <p className="font-bold text-slate-900 flex items-center gap-1.5">
                            {u.first_name} {u.last_name}
                            {isCurrent && (
                              <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                                (You)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400" /> {u.email}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <Badge variant={getRoleBadgeVariant(u.role)}>{u.role}</Badge>
                      </td>
                      <td className="py-4 px-6 text-slate-600">
                        {u.medical_license_number ? (
                          <span className="flex items-center gap-1 font-mono text-xs">
                            <FileBadge className="w-3.5 h-3.5 text-teal-600" />
                            {u.medical_license_number}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">N/A</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-600 text-xs">{u.phone || 'N/A'}</td>
                      <td className="py-4 px-6">
                        <Badge variant={u.is_active ? 'normal' : 'critical'} dot>
                          {u.is_active ? 'Active' : 'Deactivated'}
                        </Badge>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {!isCurrent ? (
                          <button
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                userId: u.id,
                                isActive: !u.is_active,
                              })
                            }
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.is_active
                                ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={u.is_active ? 'Deactivate Access' : 'Activate Access'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddStaffModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['labStaffList'] })}
      />
    </div>
  );
};
