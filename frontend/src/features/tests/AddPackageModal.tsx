import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal, Input, Button, Alert } from '@/components/ui';
import { testService } from '@/api/testService';
import { DiagnosticTest } from '@/types';

const packageSchema = z.object({
  code: z.string().min(2, 'Code is required').max(50),
  name: z.string().min(2, 'Package name is required').max(255),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Package price must be positive'),
  discount_percentage: z.coerce.number().min(0).max(100).default(0),
});

type FormData = z.infer<typeof packageSchema>;

export interface AddPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availableTests: DiagnosticTest[];
}

export const AddPackageModal: React.FC<AddPackageModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  availableTests,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(packageSchema) as any,
  });

  const toggleTest = (id: string) => {
    setSelectedTestIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const calculatedBasePrice = availableTests
    .filter((t) => selectedTestIds.includes(t.id))
    .reduce((sum, t) => sum + Number(t.effective_price ?? t.default_price), 0);

  const onSubmit = async (data: FormData) => {
    if (selectedTestIds.length === 0) {
      setErrorMessage('Please select at least one test to include in the package.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await testService.createPackage({
        code: data.code.toUpperCase(),
        name: data.name,
        description: data.description,
        price: data.price,
        discount_percentage: data.discount_percentage,
        test_ids: selectedTestIds,
      });
      reset();
      setSelectedTestIds([]);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to create package.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Diagnostic Health Package" maxWidth="lg">
      {errorMessage && (
        <Alert type="error" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Package Code *"
            placeholder="e.g. PKG-WELLNESS"
            {...register('code')}
            error={errors.code?.message}
            required
          />
          <Input
            label="Package Name *"
            placeholder="e.g. Comprehensive Annual Health Check"
            {...register('name')}
            error={errors.name?.message}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Package Description
          </label>
          <textarea
            {...register('description')}
            rows={2}
            placeholder="Overview of included tests and clinical benefits..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Bundle Selling Price (₹) *"
            type="number"
            step="0.01"
            {...register('price')}
            error={errors.price?.message}
            required
          />
          <Input
            label="Displayed Discount (%)"
            type="number"
            step="0.1"
            {...register('discount_percentage')}
            error={errors.discount_percentage?.message}
          />
        </div>

        {/* Test selection worklist */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Select Tests to Include ({selectedTestIds.length} selected)
            </span>
            <span className="text-xs text-slate-500">
              Individual sum:{' '}
              <strong className="text-slate-800">₹{calculatedBasePrice.toFixed(2)}</strong>
            </span>
          </div>

          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
            {availableTests.map((t) => {
              const checked = selectedTestIds.includes(t.id);
              return (
                <label
                  key={t.id}
                  className={`flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer text-sm ${
                    checked ? 'bg-brand-50/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTest(t.id)}
                      className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                    />
                    <div>
                      <span className="font-semibold text-slate-800">{t.name}</span>
                      <span className="text-xs text-slate-400 ml-2">({t.code})</span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    ₹{Number(t.effective_price ?? t.default_price).toFixed(2)}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Create Package
          </Button>
        </div>
      </form>
    </Modal>
  );
};
