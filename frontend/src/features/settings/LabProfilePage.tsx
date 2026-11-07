import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Building2, Save, Upload, Trash2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { labApi } from '@/api/labService';
import { useAuthStore } from '@/store/authStore';
import { Input, Button, Card, CardHeader, CardTitle, CardContent, Alert, LoadingSpinner, Badge, toast, confirmDialog } from '@/components/ui';
import { LaboratoryUpdatePayload } from '@/types';

const profileSchema = z.object({
  name: z.string().min(2, 'Laboratory name is required'),
  legal_name: z.string().optional(),
  registration_number: z.string().optional(),
  tax_identifier: z.string().optional(),
  email: z.string().email('Valid email required'),
  phone: z.string().min(6, 'Valid contact phone required'),
  website: z.string().optional(),
  address_street: z.string().min(3, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postal_code: z.string().min(3, 'Postal code is required'),
});

type FormData = z.infer<typeof profileSchema>;

export const LabProfilePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: lab, isLoading } = useQuery({
    queryKey: ['labProfile'],
    queryFn: labApi.getProfile,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (lab) {
      reset({
        name: lab.name,
        legal_name: lab.legal_name || '',
        registration_number: lab.registration_number || '',
        tax_identifier: lab.tax_identifier || '',
        email: lab.email,
        phone: lab.phone,
        website: lab.website || '',
        address_street: lab.address_street,
        city: lab.city,
        state: lab.state,
        postal_code: lab.postal_code,
      });
    }
  }, [lab, reset]);

  const updateMutation = useMutation({
    mutationFn: (payload: LaboratoryUpdatePayload) => labApi.updateProfile(payload),
    onSuccess: (updated) => {
      setSuccessMessage('Laboratory profile updated successfully.');
      toast.success('Laboratory organization profile updated successfully.');
      queryClient.setQueryData(['labProfile'], updated);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update profile';
      setErrorMessage(msg);
      toast.error(msg);
    },
  });

  const onSubmit = (data: FormData) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    updateMutation.mutate(data);
  };

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    try {
      const updatedLab = await labApi.uploadLogo(file);
      queryClient.setQueryData(['labProfile'], updatedLab);
      useAuthStore.getState().updateUser({ lab_logo_url: updatedLab.logo_url });
      toast.success('Laboratory brand logo uploaded successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to upload laboratory logo.');
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleLogoDelete = async () => {
    const confirmed = await confirmDialog({
      title: 'Remove Laboratory Brand Logo?',
      message: 'Are you sure you want to remove the laboratory logo? Workspace headers and login screen will revert to standard branding.',
      confirmText: 'Yes, Remove Logo',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsUploadingLogo(true);
    try {
      const updatedLab = await labApi.deleteLogo();
      queryClient.setQueryData(['labProfile'], updatedLab);
      useAuthStore.getState().updateUser({ lab_logo_url: null });
      toast.success('Laboratory brand logo removed successfully.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to remove laboratory logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" label="Loading laboratory specifications..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-brand-600" />
            Laboratory Organization Profile
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Update facility details, registered entity names, and contact parameters.
          </p>
        </div>

        {lab && (
          <div className="flex items-center gap-2">
            <Badge variant="brand">{lab.code}</Badge>
            <Badge variant="normal" dot>
              Active Tenant
            </Badge>
          </div>
        )}
      </div>

      {/* Laboratory Brand Logo */}
      <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-brand-600" />
            Official Laboratory Brand Logo
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            This brand logo is displayed across your authenticated workspace header, navigation sidebar, and the staff login screen.
          </p>
        </div>

        {lab?.logo_url ? (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl border border-slate-300 bg-white p-1.5 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
                <img
                  src={`/storage/${lab.logo_url.replace(/^(\.\/)?storage\//, '')}`}
                  alt={lab.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  Active Brand Logo
                </span>
                <span className="text-xs text-emerald-700 font-medium flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active in Workspace &amp; Login
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  High-res image optimized for clinical reports and portal headers.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-xs">
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
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
                className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 h-8 px-2.5"
                title="Remove Logo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-800 block">
                  No Custom Logo Uploaded
                </span>
                <span className="text-xs text-slate-500">
                  Upload an official logo (PNG, JPG, SVG) to brand your workspace and staff login screen.
                </span>
              </div>
            </div>

            <label className="cursor-pointer shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-brand-600 rounded-lg hover:bg-brand-700 shadow-sm">
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

      <Card>
        <CardHeader>
          <CardTitle>Organization Demographics & Facility Address</CardTitle>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Laboratory Name *"
                error={errors.name?.message}
                {...register('name')}
              />
              <Input
                label="Legal Registered Name"
                placeholder="e.g. Apex Diagnostics Pvt Ltd"
                error={errors.legal_name?.message}
                {...register('legal_name')}
              />
              <Input
                label="Council Registration Number"
                placeholder="REG-2024-8890"
                error={errors.registration_number?.message}
                {...register('registration_number')}
              />
              <Input
                label="Tax Identification / GSTIN"
                placeholder="GSTIN27AABCL1234D1Z5"
                error={errors.tax_identifier?.message}
                {...register('tax_identifier')}
              />
              <Input
                label="Primary Email Address *"
                type="email"
                error={errors.email?.message}
                {...register('email')}
              />
              <Input
                label="Official Phone *"
                error={errors.phone?.message}
                {...register('phone')}
              />
              <Input
                label="Website URL"
                placeholder="https://demolab.trustmylab.in"
                error={errors.website?.message}
                {...register('website')}
              />
            </div>

            <div className="pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Physical Facility Address
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <Input
                    label="Street Address *"
                    error={errors.address_street?.message}
                    {...register('address_street')}
                  />
                </div>
                <Input label="City *" error={errors.city?.message} {...register('city')} />
                <Input label="State *" error={errors.state?.message} {...register('state')} />
                <Input
                  label="Postal Code *"
                  error={errors.postal_code?.message}
                  {...register('postal_code')}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                leftIcon={<Save className="w-4 h-4" />}
                isLoading={updateMutation.isPending}
              >
                Save Laboratory Profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
