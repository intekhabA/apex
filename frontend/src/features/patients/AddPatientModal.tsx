import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal, Input, Button, Alert } from '@/components/ui';
import { patientService } from '@/api/patientService';

const patientSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  age_years: z.coerce.number().min(0, 'Age must be non-negative').max(150),
  age_months: z.coerce.number().min(0).max(11).default(0),
  phone: z.string().min(5, 'Valid phone number required').max(32),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  blood_group: z.string().optional(),
  referring_doctor: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  address_street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  clinical_notes: z.string().optional(),
});

type FormData = z.infer<typeof patientSchema>;

export interface AddPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddPatientModal: React.FC<AddPatientModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(patientSchema) as any,
    defaultValues: {
      gender: 'MALE',
      age_years: 30,
      age_months: 0,
    },
  });

  const onSubmit = async (data: FormData) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await patientService.createPatient({
        ...data,
        email: data.email || undefined,
      });
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to register patient.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register New Patient" maxWidth="lg">
      {errorMessage && (
        <Alert type="error" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name *"
            placeholder="e.g. Ramesh"
            {...register('first_name')}
            error={errors.first_name?.message}
            required
          />
          <Input
            label="Last Name *"
            placeholder="e.g. Patel"
            {...register('last_name')}
            error={errors.last_name?.message}
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Gender *
            </label>
            <select
              {...register('gender')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <Input
            label="Age (Years) *"
            type="number"
            {...register('age_years')}
            error={errors.age_years?.message}
            required
          />
          <Input
            label="Age (Months)"
            type="number"
            {...register('age_months')}
            error={errors.age_months?.message}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Mobile Phone *"
            placeholder="+91 98765 43210"
            {...register('phone')}
            error={errors.phone?.message}
            required
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="patient@example.com"
            {...register('email')}
            error={errors.email?.message}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Blood Group"
            placeholder="e.g. B+, O+, AB-"
            {...register('blood_group')}
          />
          <Input
            label="Referring Doctor / Clinic"
            placeholder="e.g. Dr. A. K. Joshi"
            {...register('referring_doctor')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Emergency Contact Name"
            placeholder="e.g. Sunita Patel (Spouse)"
            {...register('emergency_contact_name')}
          />
          <Input
            label="Emergency Contact Phone"
            placeholder="+91 98765 00000"
            {...register('emergency_contact_phone')}
          />
        </div>

        <div>
          <Input
            label="Street Address"
            placeholder="Flat / Building, Road name"
            {...register('address_street')}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input label="City" placeholder="Mumbai" {...register('city')} />
          <Input label="State" placeholder="Maharashtra" {...register('state')} />
          <Input label="Postal Code" placeholder="400001" {...register('postal_code')} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Clinical History / Notes
          </label>
          <textarea
            {...register('clinical_notes')}
            rows={2}
            placeholder="Known allergies, diabetic history, ongoing treatments..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Register Patient
          </Button>
        </div>
      </form>
    </Modal>
  );
};
