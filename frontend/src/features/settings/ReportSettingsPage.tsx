import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FileCheck, Save, ShieldCheck, QrCode, PenTool, Upload, Trash2, Building2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { labApi } from '@/api/labService';
import { adminApi } from '@/api/adminService';
import { useAuthStore } from '@/store/authStore';
import { Input, Button, Card, CardHeader, CardTitle, CardContent, Alert, LoadingSpinner, toast, confirmDialog } from '@/components/ui';
import { LaboratorySettingsUpdatePayload } from '@/types';

const settingsSchema = z.object({
  report_disclaimer: z.string().min(5, 'Report disclaimer text required'),
  currency_code: z.string().min(1).max(5),
  currency_symbol: z.string().min(1).max(5),
  default_tax_rate: z.coerce.number().min(0).max(100),
  enable_qr_verification: z.boolean(),
  show_report_header_status: z.boolean(),
  show_qr_side_text: z.boolean(),
  use_letterhead_background: z.boolean().optional(),
  letterhead_top_margin_mm: z.coerce.number().min(10).max(120).optional(),
  letterhead_bottom_margin_mm: z.coerce.number().min(10).max(100).optional(),
  primary_color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be valid hex color (e.g. #0284c7)'),
  secondary_color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be valid hex color'),
  default_signatory_name: z.string().optional(),
  default_signatory_designation: z.string().optional(),
  default_signatory_degrees: z.string().optional(),
  default_signatory_reg_no: z.string().optional(),
});

type FormData = z.infer<typeof settingsSchema>;

export const ReportSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const [selectedLabId, setSelectedLabId] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploadingSig, setIsUploadingSig] = useState<boolean>(false);
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState<boolean>(false);

  const { data: laboratories = [] } = useQuery({
    queryKey: ['adminLaboratories'],
    queryFn: () => adminApi.listLaboratories(),
    enabled: isSuperAdmin,
  });

  useEffect(() => {
    if (isSuperAdmin && laboratories.length > 0 && !selectedLabId) {
      setSelectedLabId(laboratories[0].id);
    }
  }, [isSuperAdmin, laboratories, selectedLabId]);

  const activeLabId = isSuperAdmin ? selectedLabId || undefined : undefined;

  const { data: settings, isLoading } = useQuery({
    queryKey: ['labSettings', activeLabId],
    queryFn: () => labApi.getSettings(activeLabId),
    enabled: !isSuperAdmin || !!activeLabId,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    if (settings) {
      reset({
        report_disclaimer: settings.report_disclaimer || '',
        currency_code: settings.currency_code || 'INR',
        currency_symbol: settings.currency_symbol || '₹',
        default_tax_rate: settings.default_tax_rate || 0,
        enable_qr_verification: settings.enable_qr_verification ?? true,
        show_report_header_status: settings.show_report_header_status ?? true,
        show_qr_side_text: settings.show_qr_side_text ?? true,
        use_letterhead_background: settings.use_letterhead_background ?? true,
        letterhead_top_margin_mm: settings.letterhead_top_margin_mm ?? 48,
        letterhead_bottom_margin_mm: settings.letterhead_bottom_margin_mm ?? 28,
        primary_color_hex: settings.primary_color_hex || '#0284c7',
        secondary_color_hex: settings.secondary_color_hex || '#0f172a',
        default_signatory_name: settings.default_signatory_name || '',
        default_signatory_designation: settings.default_signatory_designation || '',
        default_signatory_degrees: settings.default_signatory_degrees || '',
        default_signatory_reg_no: settings.default_signatory_reg_no || '',
      });
    }
  }, [settings, reset]);

  const updateMutation = useMutation({
    mutationFn: (payload: LaboratorySettingsUpdatePayload) => labApi.updateSettings(payload, activeLabId),
    onSuccess: (updated) => {
      setSuccessMessage('Report templates and signatory specifications saved.');
      toast.success('Report templates and signatory specifications saved.');
      queryClient.setQueryData(['labSettings', activeLabId], updated);
      queryClient.invalidateQueries({ queryKey: ['adminLaboratories'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update settings';
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  const onSubmit = (data: FormData) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    updateMutation.mutate(data);
  };

  const handleSigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingSig(true);
    setErrorMessage(null);
    try {
      const updated = await labApi.uploadSignature(file);
      queryClient.setQueryData(['labSettings'], updated);
      setSuccessMessage('Laboratory certified signature image uploaded successfully.');
      toast.success('Laboratory certified signature image uploaded successfully.');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to upload signature image';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsUploadingSig(false);
      e.target.value = '';
    }
  };

  const handleSigDelete = async () => {
    const confirmed = await confirmDialog({
      title: 'Remove Certified Signature?',
      message: 'Are you sure you want to delete this custom signature? It will revert to the default standard certified signature.',
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsUploadingSig(true);
    setErrorMessage(null);
    try {
      const updated = await labApi.deleteSignature();
      queryClient.setQueryData(['labSettings'], updated);
      setSuccessMessage('Signature reset to standard certified signature.');
      toast.success('Signature deleted and reset to standard certified signature.');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to reset signature';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsUploadingSig(false);
    }
  };

  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLetterhead(true);
    setErrorMessage(null);
    try {
      const updated = await labApi.uploadLetterhead(file, activeLabId);
      queryClient.setQueryData(['labSettings', activeLabId], updated);
      setSuccessMessage('Laboratory letterhead background graphic uploaded successfully.');
      toast.success('Laboratory letterhead background graphic uploaded successfully.');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to upload letterhead image';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsUploadingLetterhead(false);
      e.target.value = '';
    }
  };

  const handleLetterheadDelete = async () => {
    const confirmed = await confirmDialog({
      title: 'Remove Laboratory Letterhead Graphic?',
      message: 'Are you sure you want to remove this letterhead graphic? Reports will revert to plain paper format without background.',
      confirmText: 'Yes, Remove Letterhead',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsUploadingLetterhead(true);
    setErrorMessage(null);
    try {
      const updated = await labApi.deleteLetterhead(activeLabId);
      queryClient.setQueryData(['labSettings', activeLabId], updated);
      setSuccessMessage('Laboratory letterhead graphic removed successfully.');
      toast.success('Laboratory letterhead graphic removed successfully.');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to remove letterhead';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsUploadingLetterhead(false);
    }
  };

  const primaryColor = watch('primary_color_hex') || '#0284c7';

  if (isLoading) {
    return <LoadingSpinner size="lg" label="Loading report configuration..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <FileCheck className="w-7 h-7 text-brand-600" />
          Report Templates & Signatory Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure diagnostic report disclaimers, branding colors, tax defaults, and medical signatory details.
        </p>
      </div>

      {isSuperAdmin && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-amber-950 text-sm">Super Admin Mode: Platform Laboratory Selection</p>
              <p className="text-xs text-amber-700">Select a diagnostic laboratory to configure its report header, QR verification, and PDF layout options.</p>
            </div>
          </div>
          <div className="w-full sm:w-80">
            <select
              value={selectedLabId}
              onChange={(e) => setSelectedLabId(e.target.value)}
              className="w-full text-xs font-semibold rounded-lg border-amber-300 bg-white text-slate-800 focus:ring-amber-500 py-2 px-3 shadow-sm"
            >
              {laboratories.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Medical Signatory & Disclaimers</CardTitle>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <Alert type="success" className="mb-6" onDismiss={() => setSuccessMessage(null)}>
              {successMessage}
            </Alert>
          )}
          {errorMessage && (
            <Alert type="error" className="mb-6" onDismiss={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
            {/* Signatory Details */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> Default Certified Signatory
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Signatory Full Name"
                  placeholder="Dr. Rajesh Varma"
                  error={errors.default_signatory_name?.message}
                  {...register('default_signatory_name')}
                />
                <Input
                  label="Clinical Designation"
                  placeholder="Chief Consultant Pathologist"
                  error={errors.default_signatory_designation?.message}
                  {...register('default_signatory_designation')}
                />
                <Input
                  label="Medical Degrees & Qualifications"
                  placeholder="MD (Pathology), DCP"
                  error={errors.default_signatory_degrees?.message}
                  {...register('default_signatory_degrees')}
                />
                <Input
                  label="Medical Council Registration No."
                  placeholder="MCI-1998-04561"
                  error={errors.default_signatory_reg_no?.message}
                  {...register('default_signatory_reg_no')}
                />
              </div>

              {/* Human Signature Image Section */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-teal-600" /> Human Signature Image on Diagnostic Reports
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-48 bg-white border border-slate-300 rounded-lg flex items-center justify-center p-2 shadow-inner overflow-hidden">
                      {settings?.default_signatory_signature_url ? (
                        <img
                          src={`/storage/${settings.default_signatory_signature_url.replace(/^(\.\/)?storage\//, '')}`}
                          alt="Doctor Signature"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-slate-400 italic">Default system signature</span>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">
                        {settings?.default_signatory_signature_url ? 'Custom Signature Active' : 'Default Certified Signature'}
                      </p>
                      <p className="text-xs text-slate-500">
                        PNG with transparent background recommended (Max 3MB).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium rounded-lg transition-colors shadow-sm">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingSig ? 'Uploading...' : 'Upload Image'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={isUploadingSig}
                        onChange={handleSigUpload}
                      />
                    </label>
                    {settings?.default_signatory_signature_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:bg-rose-50 text-xs"
                        onClick={handleSigDelete}
                        disabled={isUploadingSig}
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Disclaimer & Tax */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Legal Disclaimer & Financial Configurations
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Report Legal Disclaimer *
                  </label>
                  <textarea
                    rows={3}
                    className="block w-full rounded-lg border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    {...register('report_disclaimer')}
                  />
                  {errors.report_disclaimer && (
                    <p className="mt-1 text-xs text-rose-600">{errors.report_disclaimer.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Currency Code"
                    placeholder="INR"
                    error={errors.currency_code?.message}
                    {...register('currency_code')}
                  />
                  <Input
                    label="Currency Symbol"
                    placeholder="₹"
                    error={errors.currency_symbol?.message}
                    {...register('currency_symbol')}
                  />
                  <Input
                    label="Default Tax Rate (%)"
                    type="number"
                    step="0.01"
                    placeholder="5.00"
                    error={errors.default_tax_rate?.message}
                    {...register('default_tax_rate')}
                  />
                </div>
              </div>
            </div>

            {/* Branding & QR */}
            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-brand-600" /> Branding Colors & Security
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Input
                    label="Primary Report Header Color"
                    placeholder="#0284c7"
                    error={errors.primary_color_hex?.message}
                    {...register('primary_color_hex')}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="w-6 h-6 rounded border border-slate-300 shadow-inner"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span className="text-xs text-slate-500">Color preview swatch</span>
                  </div>
                </div>

                <div>
                  <Input
                    label="Secondary Theme Color"
                    placeholder="#0f172a"
                    error={errors.secondary_color_hex?.message}
                    {...register('secondary_color_hex')}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="show_report_header_status"
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 mt-0.5"
                    {...register('show_report_header_status')}
                  />
                  <div>
                    <label htmlFor="show_report_header_status" className="text-sm font-semibold text-slate-700 cursor-pointer">
                      Show Report Number, Status &amp; Version in Header
                    </label>
                    <p className="text-xs text-slate-500">
                      When enabled, displays <code>REPORT #REP-..., STATUS: FINAL, Version: v1.0</code> on the top right of the PDF report. When disabled, this block is omitted.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="enable_qr"
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 mt-0.5"
                    {...register('enable_qr_verification')}
                  />
                  <div>
                    <label htmlFor="enable_qr" className="text-sm font-semibold text-slate-700 cursor-pointer">
                      Stamp Tamper-Proof Cryptographic QR Code on Finalized Reports
                    </label>
                    <p className="text-xs text-slate-500">
                      When enabled, adds a scannable QR verification code in the report footer.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 ml-6">
                  <input
                    type="checkbox"
                    id="show_qr_side_text"
                    disabled={!watch('enable_qr_verification')}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 mt-0.5 disabled:opacity-50"
                    {...register('show_qr_side_text')}
                  />
                  <div>
                    <label htmlFor="show_qr_side_text" className="text-sm font-semibold text-slate-700 cursor-pointer">
                      Show Verification Details (Portal URL &amp; HMAC Hash) Beside QR Code
                    </label>
                    <p className="text-xs text-slate-500">
                      When unchecked, side verification text is hidden, and only <strong>Scan QR to Verify Authenticity Online</strong> is displayed directly below the QR code.
                    </p>
                  </div>
                </div>
              </div>

              {/* Lab Letterhead Background Image & Clearance Margins */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-1">
                  <ImageIcon className="w-4 h-4 text-teal-600" />
                  A4 Laboratory Letterhead Graphic &amp; Clearance Margins
                </h4>
                <p className="text-xs text-slate-500 mb-4">
                  Upload an official A4 letterhead graphic (with your lab's pre-designed header branding and footer). When enabled, this letterhead is rendered as the full-page background on patient diagnostic reports.
                </p>

                {/* Letterhead Preview / Upload Box */}
                <div className="mb-4">
                  {settings?.letterhead_image_url ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={`/storage/${settings.letterhead_image_url.replace(/^(\.\/)?storage\//, '')}`}
                            alt="Letterhead Preview"
                            className="w-16 h-22 object-cover rounded-lg border border-slate-300 shadow-sm bg-white"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              Active Letterhead Background Graphic
                            </span>
                            <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Rendered on PDF Reports
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              Recommended resolution: 1240 × 1754 px or 2480 × 3508 px (A4 standard)
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <label className="cursor-pointer">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm">
                              <Upload className="w-3.5 h-3.5 text-slate-500" />
                              {isUploadingLetterhead ? 'Uploading...' : 'Replace Letterhead'}
                            </span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="hidden"
                              disabled={isUploadingLetterhead}
                              onChange={handleLetterheadUpload}
                            />
                          </label>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleLetterheadDelete}
                            disabled={isUploadingLetterhead}
                            className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 h-8 px-2.5"
                            title="Remove Letterhead Image"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 pt-2 border-t border-slate-200">
                        <input
                          type="checkbox"
                          id="use_letterhead_background"
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 w-4 h-4 mt-0.5 cursor-pointer"
                          {...register('use_letterhead_background')}
                        />
                        <div>
                          <label htmlFor="use_letterhead_background" className="text-xs font-bold text-slate-800 cursor-pointer">
                            Display Letterhead Background on Generated PDF Reports
                          </label>
                          <p className="text-[11px] text-slate-500">
                            When enabled, report text and tables flow on top of this background graphic.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            No Letterhead Background Uploaded
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Upload a pre-designed A4 letterhead graphic (PNG/JPG, up to 10MB) to brand all reports for this lab.
                          </span>
                        </div>
                      </div>

                      <label className="cursor-pointer shrink-0">
                        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 shadow-sm">
                          <Upload className="w-3.5 h-3.5" />
                          {isUploadingLetterhead ? 'Uploading...' : 'Upload A4 Letterhead'}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          disabled={isUploadingLetterhead}
                          onChange={handleLetterheadUpload}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Clearance Margins */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Header Clearance Margin (mm)
                    </label>
                    <Input
                      type="number"
                      min={10}
                      max={120}
                      {...register('letterhead_top_margin_mm')}
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">Default: 48 mm (~1.9 in) — Top space reserved for header graphic</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Footer Clearance Margin (mm)
                    </label>
                    <Input
                      type="number"
                      min={10}
                      max={100}
                      {...register('letterhead_bottom_margin_mm')}
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">Default: 28 mm (~1.1 in) — Bottom space reserved for footer graphic</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                leftIcon={<Save className="w-4 h-4" />}
                isLoading={updateMutation.isPending}
              >
                Save Report Specifications
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
