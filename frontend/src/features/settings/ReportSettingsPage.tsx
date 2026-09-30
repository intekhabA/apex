import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { FileCheck, Save, ShieldCheck, QrCode } from 'lucide-react';
import { labApi } from '@/api/labService';
import { Input, Button, Card, CardHeader, CardTitle, CardContent, Alert, LoadingSpinner } from '@/components/ui';
import { LaboratorySettingsUpdatePayload } from '@/types';

const settingsSchema = z.object({
  report_disclaimer: z.string().min(5, 'Report disclaimer text required'),
  currency_code: z.string().min(1).max(5),
  currency_symbol: z.string().min(1).max(5),
  default_tax_rate: z.coerce.number().min(0).max(100),
  enable_qr_verification: z.boolean(),
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['labSettings'],
    queryFn: labApi.getSettings,
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
    mutationFn: (payload: LaboratorySettingsUpdatePayload) => labApi.updateSettings(payload),
    onSuccess: (updated) => {
      setSuccessMessage('Report templates and signatory specifications saved.');
      queryClient.setQueryData(['labSettings'], updated);
    },
    onError: (err: any) => {
      setErrorMessage(
        err?.response?.data?.message || err?.message || 'Failed to update settings'
      );
    },
  });

  const onSubmit = (data: FormData) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    updateMutation.mutate(data);
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

              <div className="mt-4 flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="enable_qr"
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4"
                  {...register('enable_qr_verification')}
                />
                <label htmlFor="enable_qr" className="text-sm font-semibold text-slate-700 cursor-pointer">
                  Stamp Tamper-Proof Cryptographic QR Code on Finalized Reports
                </label>
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
