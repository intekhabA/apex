import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal, Input, Button, Alert, toast } from '@/components/ui';
import { testService } from '@/api/testService';
import { DiagnosticTest, TestCategory } from '@/types';

const editTestSchema = z.object({
  category_id: z.string().min(1, 'Category is required'),
  code: z.string().min(2, 'Code is required').max(50),
  name: z.string().min(2, 'Test name is required').max(255),
  short_name: z.string().optional(),
  test_type: z.enum(['PATHOLOGY', 'BIOCHEMISTRY', 'RADIOLOGY', 'CARDIOLOGY', 'OTHER']),
  sample_type: z.enum([
    'WHOLE_BLOOD_EDTA',
    'SERUM',
    'PLASMA_CITRATE',
    'URINE_ROUTINE',
    'URINE_24HR',
    'STOOL',
    'CSF',
    'SWAB',
    'IMAGING',
    'OTHER',
  ]),
  sample_container: z.string().optional(),
  preparation_instructions: z.string().optional(),
  turnaround_hours: z.coerce.number().min(1, 'TAT must be at least 1 hour').default(24),
  default_price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  is_active: z.boolean().default(true),
});

type EditFormData = z.infer<typeof editTestSchema>;

export interface EditTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  test: DiagnosticTest | null;
  categories: TestCategory[];
}

export const EditTestModal: React.FC<EditTestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  test,
  categories,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormData>({
    resolver: zodResolver(editTestSchema) as any,
  });

  useEffect(() => {
    if (test && isOpen) {
      reset({
        category_id: test.category_id,
        code: test.code,
        name: test.name,
        short_name: test.short_name || '',
        test_type: test.test_type,
        sample_type: test.sample_type,
        sample_container: test.sample_container || '',
        preparation_instructions: test.preparation_instructions || '',
        turnaround_hours: test.turnaround_hours,
        default_price: Number(test.default_price),
        is_active: test.is_active,
      });
      setErrorMessage(null);
    }
  }, [test, isOpen, reset]);

  const onSubmit = async (data: EditFormData) => {
    if (!test) return;
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await testService.updateTest(test.id, {
        ...data,
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
      });
      toast.success(`Diagnostic test "${data.name.trim()}" updated successfully.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || 'Failed to update diagnostic test.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !test) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Diagnostic Test"
      description={`Modify test properties and correct any catalog inaccuracies for [${test.code}]`}
      maxWidth="lg"
    >
      {errorMessage && (
        <Alert type="error" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
        {/* Category & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Category *
            </label>
            <select
              {...register('category_id')}
              className="w-full text-sm rounded-lg border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            {errors.category_id && (
              <p className="text-xs text-rose-500 mt-1">{errors.category_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Catalog Status
            </label>
            <select
              {...register('is_active', {
                setValueAs: (v) => v === 'true' || v === true,
              })}
              className="w-full text-sm rounded-lg border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="true">Active & Available in Catalog</option>
              <option value="false">Inactive / Deprecated</option>
            </select>
          </div>
        </div>

        {/* Code & Name */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Unique Code *
            </label>
            <Input
              {...register('code')}
              placeholder="e.g. CBC"
              className="uppercase font-mono"
              error={errors.code?.message}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Full Clinical Name *
            </label>
            <Input
              {...register('name')}
              placeholder="e.g. Complete Blood Count (CBC)"
              error={errors.name?.message}
            />
          </div>
        </div>

        {/* Short Name & Department */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Short Name / Acronym
            </label>
            <Input {...register('short_name')} placeholder="e.g. CBC" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Diagnostic Department
            </label>
            <select
              {...register('test_type')}
              className="w-full text-sm rounded-lg border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="PATHOLOGY">Pathology / Hematology</option>
              <option value="BIOCHEMISTRY">Clinical Biochemistry</option>
              <option value="RADIOLOGY">Radiology & Sonography</option>
              <option value="CARDIOLOGY">Cardiology & Diagnostics</option>
              <option value="OTHER">Other Clinical Specialty</option>
            </select>
          </div>
        </div>

        {/* Sample Type & Container */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Sample / Specimen Type
            </label>
            <select
              {...register('sample_type')}
              className="w-full text-sm rounded-lg border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="WHOLE_BLOOD_EDTA">Whole Blood (EDTA)</option>
              <option value="SERUM">Serum (Clot Activator / SST)</option>
              <option value="PLASMA_CITRATE">Plasma (Sodium Citrate)</option>
              <option value="URINE_ROUTINE">Routine Urine Specimen</option>
              <option value="URINE_24HR">24-Hour Urine Collection</option>
              <option value="STOOL">Stool Specimen</option>
              <option value="CSF">Cerebrospinal Fluid (CSF)</option>
              <option value="SWAB">Swab Specimen</option>
              <option value="IMAGING">Diagnostic Imaging / Machine Tracing</option>
              <option value="OTHER">Other Specimen</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Container / Tube Color
            </label>
            <Input
              {...register('sample_container')}
              placeholder="e.g. Lavender Top (EDTA Vacutainer)"
            />
          </div>
        </div>

        {/* Turnaround Time & Default Catalog Price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Turnaround Time (Hours) *
            </label>
            <Input
              type="number"
              {...register('turnaround_hours')}
              placeholder="24"
              error={errors.turnaround_hours?.message}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Default Catalog Price (₹ INR) *
            </label>
            <Input
              type="number"
              step="any"
              {...register('default_price')}
              placeholder="450.00"
              error={errors.default_price?.message}
            />
          </div>
        </div>

        {/* Preparation Instructions */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Patient Preparation & Fasting Instructions
          </label>
          <textarea
            {...register('preparation_instructions')}
            rows={2}
            className="w-full text-sm rounded-lg border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            placeholder="e.g. 10-12 hours overnight fasting recommended. Water permitted."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving Changes...' : 'Save & Update Test'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
