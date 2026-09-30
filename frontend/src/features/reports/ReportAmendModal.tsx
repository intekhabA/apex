import React, { useState } from 'react';
import { Modal, Button, Alert } from '@/components/ui';
import { reportService } from '@/api/reportService';
import { AlertCircle } from 'lucide-react';

export interface ReportAmendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reportId: string | null;
  reportDisplayId?: string;
  currentVersion?: number;
}

export const ReportAmendModal: React.FC<ReportAmendModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  reportId,
  reportDisplayId,
  currentVersion = 1,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportId) return;

    if (!reason.trim() || reason.trim().length < 5) {
      setErrorMessage('Please provide a substantive clinical or technical reason for this amendment (minimum 5 characters).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await reportService.amendReport(reportId, reason.trim());
      onSuccess();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to initialize report amendment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Create Versioned Amendment: ${reportDisplayId || ''}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && <Alert type="error">{errorMessage}</Alert>}

        <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-amber-800 text-xs flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Audit-Locked Medical Protocol</span>
            Creating an amendment will archive the current Version {currentVersion}.0 into an immutable snapshot and generate a mutable Version {currentVersion + 1}.0 for laboratory re-entry and secondary review.
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Clinical / Technical Justification for Amendment *
          </label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Clinician requested repeat assay on secondary analyzer; sample re-diluted to confirm elevated analyte level..."
            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-sans"
            required
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Archiving & Initializing...' : `Create Version ${currentVersion + 1}.0`}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
