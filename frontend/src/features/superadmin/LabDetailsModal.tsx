import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, MapPin, Users, Settings, CheckCircle2, XCircle, FileText, Upload, Trash2, Image as ImageIcon, Globe } from 'lucide-react';
import { Modal, Badge, Button, LoadingSpinner, toast, confirmDialog } from '@/components/ui';
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
  const [topMarginMm, setTopMarginMm] = useState<number>(48);
  const [bottomMarginMm, setBottomMarginMm] = useState<number>(28);
  const [useLetterheadBg, setUseLetterheadBg] = useState<boolean>(true);
  const [footerCodeType, setFooterCodeType] = useState<'BARCODE' | 'QR_CODE' | 'BOTH' | 'NONE'>('BARCODE');
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState<boolean>(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);

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
      setFooterCodeType(lab.settings.footer_code_type ?? 'BARCODE');
      setQrSideText(lab.settings.show_qr_side_text ?? true);
      setTopMarginMm(lab.settings.letterhead_top_margin_mm ?? 48);
      setBottomMarginMm(lab.settings.letterhead_bottom_margin_mm ?? 28);
      setUseLetterheadBg(lab.settings.use_letterhead_background ?? true);
      setTimezone(lab.settings.timezone || 'Asia/Kolkata');
    }
  }, [lab?.settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: (payload: LaboratorySettingsUpdatePayload) =>
      adminApi.updateLaboratorySettings(labId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLabDetail', labId] });
      queryClient.invalidateQueries({ queryKey: ['adminLaboratories'] });
      toast.success(`Settings and specifications for '${lab?.name}' updated successfully.`);
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
      footer_code_type: footerCodeType,
      show_qr_side_text: qrSideText,
      letterhead_top_margin_mm: topMarginMm,
      letterhead_bottom_margin_mm: bottomMarginMm,
      use_letterhead_background: useLetterheadBg,
      timezone: timezone || 'Asia/Kolkata',
    });
  };

  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !labId) return;
    setIsUploadingLetterhead(true);
    try {
      await adminApi.uploadLaboratoryLetterhead(labId, file);
      queryClient.invalidateQueries({ queryKey: ['adminLabDetail', labId] });
      queryClient.invalidateQueries({ queryKey: ['adminLaboratories'] });
      toast.success(`Letterhead background image uploaded for '${lab?.name}'.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to upload letterhead image.');
    } finally {
      setIsUploadingLetterhead(false);
      e.target.value = '';
    }
  };

  const handleLetterheadDelete = async () => {
    if (!labId) return;
    const confirmed = await confirmDialog({
      title: 'Remove Letterhead Image?',
      message: `Are you sure you want to remove the custom letterhead background for ${lab?.name}? Reports will revert to plain paper format.`,
      confirmText: 'Yes, Remove Letterhead',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsUploadingLetterhead(true);
    try {
      await adminApi.deleteLaboratoryLetterhead(labId);
      queryClient.invalidateQueries({ queryKey: ['adminLabDetail', labId] });
      queryClient.invalidateQueries({ queryKey: ['adminLaboratories'] });
      toast.success(`Letterhead image removed for '${lab?.name}'.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to remove letterhead image.');
    } finally {
      setIsUploadingLetterhead(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !labId) return;
    setIsUploadingLogo(true);
    try {
      await adminApi.uploadLaboratoryLogo(labId, file);
      queryClient.invalidateQueries({ queryKey: ['adminLabDetail', labId] });
      queryClient.invalidateQueries({ queryKey: ['adminLaboratories'] });
      toast.success(`Official logo uploaded for '${lab?.name}'.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to upload logo.');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleLogoDelete = async () => {
    if (!labId) return;
    const confirmed = await confirmDialog({
      title: 'Remove Laboratory Logo?',
      message: `Are you sure you want to remove the logo for ${lab?.name}? The laboratory login and reports will revert to the default branding.`,
      confirmText: 'Yes, Remove Logo',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsUploadingLogo(true);
    try {
      await adminApi.deleteLaboratoryLogo(labId);
      queryClient.invalidateQueries({ queryKey: ['adminLabDetail', labId] });
      queryClient.invalidateQueries({ queryKey: ['adminLaboratories'] });
      toast.success(`Logo removed for '${lab?.name}'.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to remove logo.');
    } finally {
      setIsUploadingLogo(false);
    }
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

          {/* Laboratory Brand Logo */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-brand-600" /> Laboratory Brand Logo
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Display this laboratory&apos;s custom brand logo on the lab login screen and tenant workspaces.
                </p>
              </div>
            </div>

            {lab.logo_url ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-lg border border-slate-300 bg-white p-1.5 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                    <img
                      src={`/storage/${lab.logo_url.replace(/^(\.\/)?storage\//, '')}`}
                      alt={lab.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Active Brand Logo
                    </span>
                    <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active on Lab Login &amp; Workspace
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm">
                      <Upload className="w-3 h-3 text-slate-500" />
                      {isUploadingLogo ? 'Uploading...' : 'Replace Logo'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      disabled={isUploadingLogo}
                      onChange={handleLogoUpload}
                    />
                  </label>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleLogoDelete}
                    disabled={isUploadingLogo}
                    className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 h-7 px-2"
                    title="Remove Logo"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">
                      No Custom Logo Uploaded
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Upload an official logo (PNG, JPG, SVG) for this laboratory to display during login.
                    </span>
                  </div>
                </div>

                <label className="cursor-pointer shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm">
                    <Upload className="w-3.5 h-3.5" />
                    {isUploadingLogo ? 'Uploading...' : 'Upload Brand Logo'}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={isUploadingLogo}
                    onChange={handleLogoUpload}
                  />
                </label>
              </div>
            )}
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
                  <span className="font-semibold text-slate-700">Timezone:</span>{' '}
                  {lab.settings.timezone || 'Asia/Kolkata (IST)'}
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
                  Save Configuration
                </Button>
              </div>

              <div className="space-y-3 pt-1">
                {/* Laboratory Timezone */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <label htmlFor="modal_timezone" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-brand-600" />
                    Laboratory Operating Timezone (Default: India Standard Time)
                  </label>
                  <p className="text-[11px] text-slate-500">
                    All medical report timestamps, specimen collection logs, billing receipts, and clinical records for this laboratory will be computed and formatted in this timezone.
                  </p>
                  <select
                    id="modal_timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full text-xs py-2 px-3 bg-white border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer shadow-xs"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata — India Standard Time (IST, UTC+05:30) [Default: India]</option>
                    <option value="Asia/Dubai">Asia/Dubai — Gulf Standard Time (GST, UTC+04:00)</option>
                    <option value="Asia/Riyadh">Asia/Riyadh — Arabia Standard Time (AST, UTC+03:00)</option>
                    <option value="Asia/Singapore">Asia/Singapore — Singapore / Malaysia (SGT, UTC+08:00)</option>
                    <option value="Asia/Dhaka">Asia/Dhaka — Bangladesh Standard Time (BST, UTC+06:00)</option>
                    <option value="Asia/Kathmandu">Asia/Kathmandu — Nepal Time (NPT, UTC+05:45)</option>
                    <option value="Europe/London">Europe/London — United Kingdom (GMT / BST, UTC+00:00)</option>
                    <option value="Europe/Paris">Europe/Paris — Central Europe (CET / CEST, UTC+01:00)</option>
                    <option value="America/New_York">America/New_York — US Eastern Time (ET, UTC-05:00)</option>
                    <option value="America/Chicago">America/Chicago — US Central Time (CT, UTC-06:00)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles — US Pacific Time (PT, UTC-08:00)</option>
                    <option value="UTC">UTC — Universal Coordinated Time (UTC+00:00)</option>
                  </select>
                </div>

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

                {/* Footer Code Selection */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="text-xs font-bold text-slate-800 block">
                    Report Footer Verification &amp; Tracking Code
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'BARCODE', label: 'Barcode Only' },
                      { id: 'QR_CODE', label: 'QR Code Only' },
                      { id: 'BOTH', label: 'Both' },
                      { id: 'NONE', label: 'None' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFooterCodeType(opt.id as any)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                          footerCodeType === opt.id
                            ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
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

                {/* Section Divider */}
                <div className="border-t border-slate-100 pt-3">
                  <h5 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2">
                    <ImageIcon className="w-3.5 h-3.5 text-teal-600" /> A4 Letterhead Background Graphic
                  </h5>
                  <p className="text-[11px] text-slate-500 mb-3">
                    Upload a high-resolution A4 letterhead graphic (with header logo/clinic details and footer). It will be rendered as the official full-page background on generated PDF reports for this laboratory.
                  </p>

                  {lab.settings.letterhead_image_url ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {lab.settings.letterhead_image_url.toLowerCase().endsWith('.pdf') ? (
                            <div className="w-16 h-20 rounded border border-rose-200 bg-rose-50 flex flex-col items-center justify-center text-rose-600 shadow-sm shrink-0">
                              <FileText className="w-7 h-7" />
                              <span className="text-[9px] font-bold mt-1 tracking-wider uppercase">PDF</span>
                            </div>
                          ) : (
                            <img
                              src={`/storage/${lab.settings.letterhead_image_url.replace(/^(\.\/)?storage\//, '')}`}
                              alt="Letterhead Preview"
                              className="w-16 h-20 object-cover rounded border border-slate-300 shadow-sm bg-white shrink-0"
                            />
                          )}
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">
                              {lab.settings.letterhead_image_url.toLowerCase().endsWith('.pdf')
                                ? 'Active Vector PDF Letterhead'
                                : 'Active Letterhead Background Template'}
                            </span>
                            <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Loaded &amp; Ready for PDF Generation
                            </span>
                            <a
                              href={`/storage/${lab.settings.letterhead_image_url.replace(/^(\.\/)?storage\//, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-teal-700 hover:text-teal-900 underline mt-0.5 inline-block font-medium"
                            >
                              Preview Letterhead Document ↗
                            </a>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm">
                              <Upload className="w-3 h-3 text-slate-500" />
                              {isUploadingLetterhead ? 'Uploading...' : 'Replace'}
                            </span>
                            <input
                              type="file"
                              accept="application/pdf,image/png,image/jpeg,image/webp"
                              className="hidden"
                              disabled={isUploadingLetterhead}
                              onChange={handleLetterheadUpload}
                            />
                          </label>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleLetterheadDelete}
                            disabled={isUploadingLetterhead}
                            className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 h-7 px-2"
                            title="Remove Letterhead Image"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 pt-2 border-t border-slate-200">
                        <input
                          type="checkbox"
                          id="modal_use_letterhead_bg"
                          checked={useLetterheadBg}
                          onChange={(e) => setUseLetterheadBg(e.target.checked)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 mt-0.5 cursor-pointer"
                        />
                        <div>
                          <label htmlFor="modal_use_letterhead_bg" className="text-xs font-bold text-slate-800 cursor-pointer">
                            Display Letterhead Background on PDF Reports
                          </label>
                          <p className="text-[10px] text-slate-500">
                            When enabled, report text and tables are overlaid directly on this letterhead.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">
                            No Custom Letterhead Uploaded
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Upload a PDF or Image (PNG/JPG) letterhead template to brand reports.
                          </span>
                        </div>
                      </div>

                      <label className="cursor-pointer shrink-0">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm">
                          <Upload className="w-3.5 h-3.5" />
                          {isUploadingLetterhead ? 'Uploading...' : 'Upload A4 Letterhead (PDF/Image)'}
                        </span>
                        <input
                          type="file"
                          accept="application/pdf,image/png,image/jpeg,image/webp"
                          className="hidden"
                          disabled={isUploadingLetterhead}
                          onChange={handleLetterheadUpload}
                        />
                      </label>
                    </div>
                  )}

                  {/* Margin Inputs */}
                  <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Header Clearance Margin (mm):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={10}
                          max={120}
                          value={topMarginMm}
                          onChange={(e) => setTopMarginMm(Math.max(10, parseInt(e.target.value) || 0))}
                          className="w-16 px-2 py-1 text-xs border border-slate-300 rounded-lg text-slate-800 font-bold text-center focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                        <span className="text-[11px] text-slate-500">mm (~{(topMarginMm / 25.4).toFixed(1)} in)</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Height reserved at page top for letterhead banner.
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Footer Clearance Margin (mm):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={10}
                          max={100}
                          value={bottomMarginMm}
                          onChange={(e) => setBottomMarginMm(Math.max(10, parseInt(e.target.value) || 0))}
                          className="w-16 px-2 py-1 text-xs border border-slate-300 rounded-lg text-slate-800 font-bold text-center focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                        <span className="text-[11px] text-slate-500">mm (~{(bottomMarginMm / 25.4).toFixed(1)} in)</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        Height reserved at page bottom for letterhead footer.
                      </span>
                    </div>
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
