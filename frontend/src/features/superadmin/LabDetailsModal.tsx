import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Users, Settings, CheckCircle2, XCircle } from 'lucide-react';
import { Modal, Badge, LoadingSpinner } from '@/components/ui';
import { adminApi } from '@/api/adminService';


export interface LabDetailsModalProps {
  labId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LabDetailsModal: React.FC<LabDetailsModalProps> = ({ labId, isOpen, onClose }) => {
  const { data: lab, isLoading } = useQuery({
    queryKey: ['adminLabDetail', labId],
    queryFn: () => (labId ? adminApi.getLaboratory(labId) : null),
    enabled: isOpen && !!labId,
  });

  const { data: staff } = useQuery({
    queryKey: ['adminLabStaff', labId],
    queryFn: () => (labId ? adminApi.getLaboratoryStaff(labId) : []),
    enabled: isOpen && !!labId,
  });

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lab?.name || 'Laboratory Overview'}
      description={`Tenant Identifier: ${lab?.code || ''}`}
      maxWidth="2xl"
    >
      {isLoading ? (
        <LoadingSpinner size="md" label="Loading laboratory specifications..." />
      ) : lab ? (
        <div className="space-y-6 text-sm">
          {/* Status & Plan Banner */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Tenant Status:</span>
              <Badge variant={lab.is_active ? 'normal' : 'critical'} dot>
                {lab.is_active ? 'Active Operation' : 'Suspended'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Plan:</span>
              <Badge variant="brand">{lab.subscription_plan}</Badge>
            </div>
          </div>

          {/* Contact & Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-100 bg-white space-y-2.5">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-brand-600" /> Facility Location
              </h4>
              <p className="text-slate-700">{lab.address_street}</p>
              <p className="text-slate-600">
                {lab.city}, {lab.state} {lab.postal_code}, {lab.country}
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-white space-y-2.5">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-400">
                <Building2 className="w-3.5 h-3.5 text-teal-600" /> Official Registrations
              </h4>
              <p className="text-slate-600">
                <strong>Legal:</strong> {lab.legal_name || 'N/A'}
              </p>
              <p className="text-slate-600">
                <strong>Reg #:</strong> {lab.registration_number || 'N/A'}
              </p>
              <p className="text-slate-600">
                <strong>Tax ID:</strong> {lab.tax_identifier || 'N/A'}
              </p>
            </div>
          </div>

          {/* Settings & Signatory */}
          {lab.settings && (
            <div className="p-4 rounded-xl border border-slate-100 bg-white space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-brand-600" /> Default Medical Signatory
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <span className="font-semibold text-slate-700">Signatory:</span>{' '}
                  {lab.settings.default_signatory_name || 'N/A'}
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Designation:</span>{' '}
                  {lab.settings.default_signatory_designation || 'N/A'}
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Currency:</span>{' '}
                  {lab.settings.currency_symbol} ({lab.settings.currency_code})
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Tax Rate:</span>{' '}
                  {lab.settings.default_tax_rate}%
                </div>
              </div>
            </div>
          )}

          {/* Assigned Staff Members */}
          <div>
            <h4 className="font-bold text-slate-800 flex items-center justify-between mb-3 text-xs uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-600" /> Assigned Staff Members ({staff?.length || 0})
              </span>
            </h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
              {staff && staff.length > 0 ? (
                staff.map((u) => (
                  <div key={u.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <p className="font-semibold text-slate-800 text-xs">{u.first_name} {u.last_name}</p>
                      <p className="text-[11px] text-slate-500">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="brand">{u.role}</Badge>
                      {u.is_active ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="p-4 text-center text-xs text-slate-400">No staff accounts provisioned yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500">Laboratory not found.</p>
      )}
    </Modal>
  );
};
