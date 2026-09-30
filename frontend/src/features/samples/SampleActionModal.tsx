import React, { useState } from 'react';
import { Modal, Input, Button, Alert } from '@/components/ui';
import { sampleService } from '@/api/sampleService';
import { SpecimenSample } from '@/types';

export interface SampleActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sample: SpecimenSample | null;
  actionType: 'collect' | 'receive' | 'reject' | null;
}

export const SampleActionModal: React.FC<SampleActionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  sample,
  actionType,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [sampleContainer, setSampleContainer] = useState('');
  const [barcodeValue, setBarcodeValue] = useState('');
  const [remarks, setRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  if (!sample || !actionType) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      if (actionType === 'collect') {
        await sampleService.collectSample({
          sample_id: sample.id,
          sample_container: sampleContainer || sample.sample_container || undefined,
          barcode_value: barcodeValue || sample.barcode_value || undefined,
          remarks: remarks || undefined,
        });
      } else if (actionType === 'receive') {
        await sampleService.receiveSample({
          sample_id: sample.id,
          remarks: remarks || undefined,
        });
      } else if (actionType === 'reject') {
        if (!rejectionReason.trim()) {
          setErrorMessage('A rejection reason is mandatory.');
          setIsSubmitting(false);
          return;
        }
        await sampleService.rejectSample({
          sample_id: sample.id,
          rejection_reason: rejectionReason,
          remarks: remarks || undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || `Failed to ${actionType} specimen.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const titles = {
    collect: `Collect Specimen: ${sample.sample_id_display}`,
    receive: `Receive Specimen: ${sample.sample_id_display}`,
    reject: `Reject Specimen: ${sample.sample_id_display}`,
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titles[actionType]} maxWidth="md">
      {errorMessage && (
        <Alert type="error" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Specimen Type:</span>
          <span className="font-semibold text-slate-800">{sample.sample_type.replace(/_/g, ' ')}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Default Container:</span>
          <span className="font-semibold text-slate-800">{sample.sample_container || 'Standard'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Barcode / ID:</span>
          <span className="font-mono font-semibold text-brand-600">{sample.sample_id_display}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {actionType === 'collect' && (
          <>
            <Input
              label="Specimen Container Tube"
              placeholder="e.g. Lavender EDTA Vacutainer 3ml"
              value={sampleContainer}
              onChange={(e) => setSampleContainer(e.target.value)}
            />
            <Input
              label="Barcode / Tube Label Value"
              placeholder={`Default: ${sample.sample_id_display}`}
              value={barcodeValue}
              onChange={(e) => setBarcodeValue(e.target.value)}
            />
          </>
        )}

        {actionType === 'reject' && (
          <div>
            <label className="block text-xs font-semibold text-rose-700 uppercase tracking-wider mb-1.5">
              Rejection Reason *
            </label>
            <select
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 border border-rose-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 mb-2"
              required
            >
              <option value="">Select standard rejection reason...</option>
              <option value="Grossly hemolyzed specimen">Grossly hemolyzed specimen</option>
              <option value="Severely lipemic / turbid">Severely lipemic / turbid</option>
              <option value="Insufficient specimen volume (QNS)">Insufficient specimen volume (QNS)</option>
              <option value="Clotted EDTA specimen">Clotted EDTA specimen</option>
              <option value="Improper collection container">Improper collection container</option>
              <option value="Mislabeled or unreadable barcode">Mislabeled or unreadable barcode</option>
              <option value="Broken / leaking transit tube">Broken / leaking transit tube</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Remarks / Phlebotomy Notes
          </label>
          <input
            type="text"
            placeholder="e.g. Collected via left antecubital vein without trauma."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={actionType === 'reject' ? 'outline' : 'primary'}
            type="submit"
            isLoading={isSubmitting}
            className={actionType === 'reject' ? 'bg-rose-600 text-white hover:bg-rose-700 border-transparent' : ''}
          >
            {actionType === 'collect' && 'Confirm Collection'}
            {actionType === 'receive' && 'Confirm Reception'}
            {actionType === 'reject' && 'Reject Specimen'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
