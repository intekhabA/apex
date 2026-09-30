import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal, Input, Button, Alert } from '@/components/ui';
import { labApi } from '@/api/labService';
import { UserCreatePayload } from '@/types';


const staffSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid work email required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  role: z.enum([
    'LAB_ADMIN',
    'LAB_ASSISTANT',
    'PATHOLOGIST',
    'RADIOLOGIST',
    'RECEPTIONIST',
  ] as const),
  medical_license_number: z.string().optional(),
  qualifications: z.string().optional(),
});

type FormData = z.infer<typeof staffSchema>;

export interface AddStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddStaffModal: React.FC<AddStaffModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      role: 'LAB_ASSISTANT',
    },
  });

  const selectedRole = watch('role');
  const isDoctor = selectedRole === 'PATHOLOGIST' || selectedRole === 'RADIOLOGIST';

  const onSubmit = async (data: FormData) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await labApi.createStaff(data as UserCreatePayload);
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message || err?.message || 'Failed to provision staff member'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Provision Staff Member Account"
      description="Create a role-scoped laboratory user account with assigned clinical permissions."
      maxWidth="lg"
    >
      {errorMessage && (
        <Alert type="error" className="mb-5" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name *"
            placeholder="Pooja"
            error={errors.first_name?.message}
            {...register('first_name')}
          />
          <Input
            label="Last Name *"
            placeholder="Nair"
            error={errors.last_name?.message}
            {...register('last_name')}
          />
        </div>

        <Input
          label="Work Email Address *"
          type="email"
          placeholder="pooja@demolab.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Initial Password *"
          type="password"
          placeholder="••••••••••••"
          helperText="Min. 8 characters"
          error={errors.password?.message}
          {...register('password')}
        />

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5">
            Workstation Role *
          </label>
          <select
            className="block w-full rounded-lg border border-slate-300 py-2.5 px-3.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            {...register('role')}
          >
            <option value="LAB_ASSISTANT">Lab Assistant / Phlebotomist</option>
            <option value="PATHOLOGIST">Consultant Pathologist (MD)</option>
            <option value="RADIOLOGIST">Consultant Radiologist (MD)</option>
            <option value="RECEPTIONIST">Billing & Frontdesk Receptionist</option>
            <option value="LAB_ADMIN">Laboratory Administrator</option>
          </select>
          {errors.role && <p className="mt-1.5 text-xs text-rose-600">{errors.role.message}</p>}
        </div>

        <Input
          label="Phone Number"
          placeholder="+91 98200 12345"
          error={errors.phone?.message}
          {...register('phone')}
        />

        {isDoctor && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Clinical Signatory Credentials
            </h5>
            <Input
              label="Medical License / Council Registration No."
              placeholder="MCI-2015-8849"
              error={errors.medical_license_number?.message}
              {...register('medical_license_number')}
            />
            <Input
              label="Degrees & Professional Qualifications"
              placeholder="MBBS, MD (Pathology), DCP"
              error={errors.qualifications?.message}
              {...register('qualifications')}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Provision Staff User
          </Button>
        </div>
      </form>
    </Modal>
  );
};
