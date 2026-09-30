import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Building2, Save } from 'lucide-react';
import { labApi } from '@/api/labService';
import { Input, Button, Card, CardHeader, CardTitle, CardContent, Alert, LoadingSpinner, Badge } from '@/components/ui';
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
      queryClient.setQueryData(['labProfile'], updated);
    },
    onError: (err: any) => {
      setErrorMessage(
        err?.response?.data?.message || err?.message || 'Failed to update profile'
      );
    },
  });

  const onSubmit = (data: FormData) => {
    setSuccessMessage(null);
    setErrorMessage(null);
    updateMutation.mutate(data);
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
                placeholder="https://demolab.diagnolab.internal"
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
