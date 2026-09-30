import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { Modal, Input, Button, Alert } from '@/components/ui';
import { testService } from '@/api/testService';
import { TestCategory } from '@/types';

const testSchema = z.object({
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
  turnaround_hours: z.coerce.number().min(1).default(24),
  default_price: z.coerce.number().min(0, 'Price must be positive'),
  parameters: z
    .array(
      z.object({
        code: z.string().min(1, 'Param code required'),
        name: z.string().min(1, 'Param name required'),
        unit: z.string().optional(),
        result_type: z.enum(['NUMBER', 'TEXT', 'SELECT', 'FORMULA', 'MULTILINE_TEXT']),
        decimal_precision: z.coerce.number().min(0).max(4).default(2),
        reference_ranges: z
          .array(
            z.object({
              gender: z.string().optional().nullable(),
              min_value: z.coerce.number().optional().nullable(),
              max_value: z.coerce.number().optional().nullable(),
              display_range_string: z.string().min(1, 'Range display string required'),
            })
          )
          .optional(),
      })
    )
    .optional(),
});

type FormData = z.infer<typeof testSchema>;

export interface AddTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: TestCategory[];
}

export const AddTestModal: React.FC<AddTestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  categories,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(testSchema) as any,
    defaultValues: {
      test_type: 'BIOCHEMISTRY',
      sample_type: 'SERUM',
      turnaround_hours: 24,
      default_price: 500,
      parameters: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parameters' as never,
  });

  const onSubmit = async (data: FormData) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await testService.createTest({
        ...data,
        code: data.code.toUpperCase(),
        is_active: true,
      });
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to create test.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddParameter = () => {
    append({
      code: '',
      name: '',
      unit: '',
      result_type: 'NUMBER',
      decimal_precision: 2,
      reference_ranges: [
        {
          gender: null,
          min_value: 0,
          max_value: 100,
          display_range_string: '0 - 100',
        },
      ],
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Master Diagnostic Test" maxWidth="lg">
      {errorMessage && (
        <Alert type="error" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Category *
            </label>
            <select
              {...register('category_id')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            {errors.category_id && (
              <p className="mt-1 text-xs text-red-500">{errors.category_id.message}</p>
            )}
          </div>
          <Input
            label="Test Code *"
            placeholder="e.g. CBC, LFT, KFT"
            {...register('code')}
            error={errors.code?.message}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Test Name *"
            placeholder="e.g. Complete Blood Count"
            {...register('name')}
            error={errors.name?.message}
            required
          />
          <Input
            label="Short Name"
            placeholder="e.g. CBC"
            {...register('short_name')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Test Department *
            </label>
            <select
              {...register('test_type')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="PATHOLOGY">Pathology</option>
              <option value="BIOCHEMISTRY">Biochemistry</option>
              <option value="RADIOLOGY">Radiology & Imaging</option>
              <option value="CARDIOLOGY">Cardiology</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Specimen / Sample Type *
            </label>
            <select
              {...register('sample_type')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="SERUM">Serum</option>
              <option value="WHOLE_BLOOD_EDTA">Whole Blood (EDTA)</option>
              <option value="PLASMA_CITRATE">Plasma (Citrate)</option>
              <option value="URINE_ROUTINE">Urine Routine</option>
              <option value="URINE_24HR">24-Hour Urine</option>
              <option value="STOOL">Stool</option>
              <option value="CSF">CSF</option>
              <option value="SWAB">Swab</option>
              <option value="IMAGING">Imaging (Non-Specimen)</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Sample Container"
            placeholder="e.g. Lavender Vacutainer"
            {...register('sample_container')}
          />
          <Input
            label="Turnaround (Hours)"
            type="number"
            {...register('turnaround_hours')}
            error={errors.turnaround_hours?.message}
          />
          <Input
            label="Default Price (₹) *"
            type="number"
            step="0.01"
            {...register('default_price')}
            error={errors.default_price?.message}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Preparation Instructions
          </label>
          <input
            {...register('preparation_instructions')}
            placeholder="e.g. 10-12 hours overnight fasting required."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Sub-parameters builder */}
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-sm font-bold text-slate-800">Sub-Parameters / Analytes</h4>
              <p className="text-xs text-slate-500">Configure parameters for panel tests (e.g. Hemoglobin, RBC)</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddParameter}
              className="flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Parameter</span>
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Analyte #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    label="Param Code"
                    placeholder="e.g. HB"
                    {...register(`parameters.${index}.code` as const)}
                    required
                  />
                  <Input
                    label="Param Name"
                    placeholder="e.g. Hemoglobin"
                    {...register(`parameters.${index}.name` as const)}
                    required
                  />
                  <Input
                    label="Unit"
                    placeholder="e.g. g/dL, mg/dL"
                    {...register(`parameters.${index}.unit` as const)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Result Type</label>
                    <select
                      {...register(`parameters.${index}.result_type` as const)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                    >
                      <option value="NUMBER">Numeric</option>
                      <option value="TEXT">Text</option>
                      <option value="SELECT">Select</option>
                    </select>
                  </div>
                  <Input
                    label="Normal Range String"
                    placeholder="e.g. 13.0 - 17.0 g/dL"
                    {...register(`parameters.${index}.reference_ranges.0.display_range_string` as const)}
                    required
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Create Test
          </Button>
        </div>
      </form>
    </Modal>
  );
};
