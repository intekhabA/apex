import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, Users, Settings, CheckCircle2, XCircle, FileText } from 'lucide-react';
import { Modal, Badge, Button, LoadingSpinner, toast } from '@/components/ui';
import { adminApi } from '@/api/adminService';
import { LaboratorySettingsUpdatePayload } from '@/types';


export interface LabDetailsModalProps {
  labId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const LabDetailsModal: React.FC<LabDetailsModalProps> = ({ labId, isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const [headerStatus, setHeaderStatus] = useState<boolean>(true);
  const [qrEnabled, setQrEnabled] = useState<boolean>(true);
  const [qrSideText, setQrSideText] = useState<boolean>(true);

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

  useEffect(() => {
    if (lab?.settings) {
      setHeaderStatus(lab.settings.show_report_header_status ?? true);
      setQrEnabled(lab.settings.enable_qr_verification ?? true);
      setQrSideText(lab.settings.show_qr_side_text ?? true);
    }
  }, [lab?.settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: (payload: LaboratorySettingsUpdatePayload) =>
      adminApi.updateLaboratorySettings(labId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLabDetail', labId] });
      queryClient.invalidateQueries({ queryKey: ['adminLaboratories'] });
      toast.success(`Report specifications for '${lab?.name}' updated successfully.`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update report settings.');
    },
  });

  const handleSaveReportSettings = () => {
    if (!labId) return;
    updateSettingsMutation.mutate({
      show_report_header_status: headerStatus,
      enable_qr_verification: qrEnabled,
      show_qr_side_text: qrSideText,
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lab?.name || 'Laboratory Overview'}
      description={`Tenant Identifier: ${lab?.code || ''}`}
      maxWidth="4xl"
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

          {/* PDF Report & Layout Toggles (Super Admin Controls) */}
          {lab.settings && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-brand-600" /> PDF Report &amp; QR Layout Controls
                </h4>
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={updateSettingsMutation.isPending}
                  onClick={handleSaveReportSettings}
                  className="text-xs h-7 px-3"
                >
                  Save Report Options
                </Button>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="modal_show_report_header_status"
                    checked={headerStatus}
                    onChange={(e) => setHeaderStatus(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="modal_show_report_header_status" className="text-xs font-bold text-slate-800 cursor-pointer">
                      Show Report Number, Status &amp; Version in Header
                    </label>
                    <p className="text-[11px] text-slate-500">
                      When enabled, displays <code>REPORT #..., STATUS: FINAL, Version: v1.0</code> on the top right. Uncheck to omit this block.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="modal_enable_qr"
                    checked={qrEnabled}
                    onChange={(e) => setQrEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <label htmlFor="modal_enable_qr" className="text-xs font-bold text-slate-800 cursor-pointer">
                      Stamp Tamper-Proof Cryptographic QR Code on Reports
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Enables the official digital verification QR code in the footer.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 ml-6">
                  <input
                    type="checkbox"
                    id="modal_show_qr_side_text"
                    disabled={!qrEnabled}
                    checked={qrSideText}
                    onChange={(e) => setQrSideText(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 mt-0.5 cursor-pointer disabled:opacity-50"
                  />
                  <div>
                    <label htmlFor="modal_show_qr_side_text" className="text-xs font-bold text-slate-800 cursor-pointer">
                      Show Verification Details Beside QR Code
                    </label>
                    <p className="text-[11px] text-slate-500">
                      When unchecked, side verification text (Portal URL &amp; HMAC digest) is hidden, and only <strong>Scan QR to Verify Authenticity Online</strong> is displayed directly below the QR code.
                    </p>
                  </div>
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
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
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
