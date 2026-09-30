import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Modal, Input, Button, Alert } from '@/components/ui';
import { testService } from '@/api/testService';
import { DiagnosticTest } from '@/types';

const pricingSchema = z.object({
  custom_price: z.coerce.number().min(0, 'Custom price must be positive'),
  discount_percentage: z.coerce.number().min(0).max(100).default(0),
  is_available: z.boolean().default(true),
});

type FormData = z.infer<typeof pricingSchema>;

export interface PricingOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  test: DiagnosticTest | null;
}

export const PricingOverrideModal: React.FC<PricingOverrideModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  test,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(pricingSchema) as any,
  });

  useEffect(() => {
    if (test) {
      reset({
        custom_price: test.effective_price ?? test.default_price,
        discount_percentage: 0,
        is_available: true,
      });
    }
  }, [test, reset]);

  if (!test) return null;

  const onSubmit = async (data: FormData) => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await testService.setPriceOverride({
        test_id: test.id,
        custom_price: data.custom_price,
        discount_percentage: data.discount_percentage,
        is_available: data.is_available,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to update custom price.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!window.confirm('Reset this test to the global catalog default price?')) return;
    setIsSubmitting(true);
    try {
      await testService.removePriceOverride(test.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || 'Failed to reset price.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Custom Pricing: ${test.name}`} maxWidth="md">
      {errorMessage && (
        <Alert type="error" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Test Code:</span>
          <span className="font-semibold text-slate-800">{test.code}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Global Default Price:</span>
          <span className="font-semibold text-slate-800">₹{Number(test.default_price).toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Current Effective Price:</span>
          <span className="font-semibold text-brand-600">
            ₹{Number(test.effective_price ?? test.default_price).toFixed(2)}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
        <Input
          label="Lab Custom Price (₹)"
          type="number"
          step="0.01"
          {...register('custom_price')}
          error={errors.custom_price?.message}
          required
        />
        <Input
          label="Promotional Discount (%)"
          type="number"
          step="0.1"
          {...register('discount_percentage')}
          error={errors.discount_percentage?.message}
        />
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_available"
            {...register('is_available')}
            className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
          />
          <label htmlFor="is_available" className="text-sm font-medium text-slate-700">
            Available in this laboratory
          </label>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Button
            variant="outline"
            type="button"
            onClick={handleResetToDefault}
            disabled={isSubmitting}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            Revert to Default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={isSubmitting}>
              Save Price
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
