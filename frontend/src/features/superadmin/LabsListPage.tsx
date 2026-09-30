import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Search,
  Eye,
  Power,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { adminApi } from '@/api/adminService';
import { Button, Input, Badge, Card, CardContent, LoadingSpinner } from '@/components/ui';
import { AddLabModal } from './AddLabModal';
import { LabDetailsModal } from './LabDetailsModal';

export const LabsListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);

  const { data: labs = [], isLoading } = useQuery({
    queryKey: ['adminLaboratories', searchTerm, statusFilter],
    queryFn: () =>
      adminApi.listLaboratories({
        search: searchTerm || undefined,
        is_active:
          statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE' ? true : false,
      }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updateLaboratoryStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLaboratories'] });
    },
  });

  const totalCount = labs.length;
  const activeCount = labs.filter((l) => l.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-brand-600" />
            Diagnostic Laboratories
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Global multi-tenant directory, onboarding provisioning, and lifecycle management.
          </p>
        </div>

        <Button
          variant="primary"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => setIsAddModalOpen(true)}
        >
          Onboard New Laboratory
        </Button>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Labs</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{totalCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Operations</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Suspended / Inactive</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{totalCount - activeCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search by lab name, code, or city..."
            leftIcon={<Search className="w-4 h-4" />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === filter
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Laboratories Table */}
      <Card>
        {isLoading ? (
          <LoadingSpinner size="lg" label="Loading laboratories..." />
        ) : labs.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-700 text-base">No laboratories found</h3>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your search criteria or onboard a new facility.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-6">Tenant Code</th>
                  <th className="py-3.5 px-6">Laboratory Name</th>
                  <th className="py-3.5 px-6">Location</th>
                  <th className="py-3.5 px-6">Contact Email</th>
                  <th className="py-3.5 px-6">Plan</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {labs.map((lab) => (
                  <tr key={lab.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-brand-700">{lab.code}</td>
                    <td className="py-4 px-6 font-semibold text-slate-900">{lab.name}</td>
                    <td className="py-4 px-6 text-slate-600">
                      {lab.city}, {lab.state}
                    </td>
                    <td className="py-4 px-6 text-slate-600">{lab.email}</td>
                    <td className="py-4 px-6">
                      <Badge variant="brand">{lab.subscription_plan}</Badge>
                    </td>
                    <td className="py-4 px-6">
                      <Badge variant={lab.is_active ? 'normal' : 'critical'} dot>
                        {lab.is_active ? 'Active' : 'Suspended'}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedLabId(lab.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="View Specifications & Staff"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() =>
                            toggleStatusMutation.mutate({
                              id: lab.id,
                              isActive: !lab.is_active,
                            })
                          }
                          className={`p-1.5 rounded-lg transition-colors ${
                            lab.is_active
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={lab.is_active ? 'Suspend Tenant' : 'Activate Tenant'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modals */}
      <AddLabModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['adminLaboratories'] })}
      />

      <LabDetailsModal
        labId={selectedLabId}
        isOpen={!!selectedLabId}
        onClose={() => setSelectedLabId(null)}
      />
    </div>
  );
};
