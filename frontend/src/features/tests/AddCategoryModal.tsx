import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal, Input, Button, Alert } from '@/components/ui';
import { testService } from '@/api/testService';

const categorySchema = z.object({
  code: z.string().min(2, 'Code is required').max(20),
  name: z.string().min(2, 'Category name is required').max(100),
  description: z.string().optional(),
  display_order: z.coerce.number().min(0).default(0),
});

type FormData = z.infer<typeof categorySchema>;

export interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(categorySchema) as any,
    defaultValues: {
      display_order: 1,
    },
  });

  const onSubmit = async (data: FormData) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await testService.createCategory({
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description,
        display_order: data.display_order,
        is_active: true,
      });
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to create category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Diagnostic Category" maxWidth="md">
      {errorMessage && (
        <Alert type="error" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Category Code"
          placeholder="e.g. HEM, BIO, RAD"
          {...register('code')}
          error={errors.code?.message}
          required
        />
        <Input
          label="Category Name"
          placeholder="e.g. Hematology, Clinical Biochemistry"
          {...register('name')}
          error={errors.name?.message}
          required
        />
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Description
          </label>
          <textarea
            {...register('description')}
            rows={3}
            placeholder="Clinical scope and details..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <Input
          label="Display Order"
          type="number"
          {...register('display_order')}
          error={errors.display_order?.message}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Save Category
          </Button>
        </div>
      </form>
    </Modal>
  );
};
