import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Building2, User } from 'lucide-react';
import { Modal, Input, Button, Alert } from '@/components/ui';
import { adminApi } from '@/api/adminService';
import { LaboratoryCreatePayload } from '@/types';

const labSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  code: z.string().min(2, 'Code is required (e.g. LAB-METRO)').max(32),
  legal_name: z.string().optional(),
  email: z.string().email('Valid lab email required'),
  phone: z.string().min(6, 'Valid contact phone required'),
  website: z.string().optional(),
  address_street: z.string().min(3, 'Street address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postal_code: z.string().min(3, 'Postal code is required'),
  subscription_plan: z.string(),
  initial_admin_first_name: z.string().min(1, 'Admin first name required'),
  initial_admin_last_name: z.string().min(1, 'Admin last name required'),
  initial_admin_email: z.string().email('Valid admin email required'),
  initial_admin_password: z.string().min(8, 'Password must be at least 8 characters'),
});

type FormData = z.infer<typeof labSchema>;


export interface AddLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddLabModal: React.FC<AddLabModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(labSchema),
    defaultValues: {
      subscription_plan: 'STANDARD',
      initial_admin_first_name: 'Lab',
      initial_admin_last_name: 'Admin',
    },
  });

  const onSubmit = async (data: FormData) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await adminApi.onboardLaboratory(data as LaboratoryCreatePayload);
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message || err?.message || 'Failed to onboard laboratory'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Onboard New Diagnostic Laboratory"
      description="Create a new laboratory workspace with automated tenant provisioning and initial administrator."
      maxWidth="2xl"
    >
      {errorMessage && (
        <Alert type="error" className="mb-5" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Lab Organization Details */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-brand-600" /> Laboratory Profile
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Laboratory Name *"
              placeholder="Apex Diagnostic Center"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Unique Tenant Code *"
              placeholder="LAB-APEX"
              helperText="Uppercase alphanumeric (e.g. LAB-METRO)"
              error={errors.code?.message}
              {...register('code')}
            />
            <Input
              label="Official Contact Email *"
              type="email"
              placeholder="contact@apexlab.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Phone Number *"
              placeholder="+91 98765 43210"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              label="Street Address *"
              placeholder="Suite 400, Health Plaza"
              error={errors.address_street?.message}
              {...register('address_street')}
            />
            <div className="grid grid-cols-3 gap-2">
              <Input label="City *" placeholder="Mumbai" error={errors.city?.message} {...register('city')} />
              <Input label="State *" placeholder="MH" error={errors.state?.message} {...register('state')} />
              <Input label="Postal Code *" placeholder="400001" error={errors.postal_code?.message} {...register('postal_code')} />
            </div>
          </div>
        </div>

        {/* Initial Lab Admin Provisioning */}
        <div className="pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-teal-600" /> Initial Lab Administrator Account
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Admin First Name *"
              placeholder="Anil"
              error={errors.initial_admin_first_name?.message}
              {...register('initial_admin_first_name')}
            />
            <Input
              label="Admin Last Name *"
              placeholder="Sharma"
              error={errors.initial_admin_last_name?.message}
              {...register('initial_admin_last_name')}
            />
            <Input
              label="Admin Login Email *"
              type="email"
              placeholder="admin@apexlab.com"
              error={errors.initial_admin_email?.message}
              {...register('initial_admin_email')}
            />
            <Input
              label="Admin Initial Password *"
              type="password"
              placeholder="••••••••••••"
              helperText="Min. 8 characters"
              error={errors.initial_admin_password?.message}
              {...register('initial_admin_password')}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Provision & Onboard Laboratory
          </Button>
        </div>
      </form>
    </Modal>
  );
};
