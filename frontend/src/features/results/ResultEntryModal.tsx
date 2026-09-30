import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Badge } from '@/components/ui';
import { resultService } from '@/api/resultService';
import { ResultSheetResponse, ResultFlag } from '@/types';

export interface ResultEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reportId: string | null;
}

interface RowValueState {
  parameter_id: string;
  parameter_name: string;
  parameter_code: string;
  unit: string;
  reference_range_display: string;
  numeric_value: string;
  text_value: string;
  technician_comment: string;
  flag: ResultFlag;
}

export const ResultEntryModal: React.FC<ResultEntryModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  reportId,
}) => {
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<ResultSheetResponse | null>(null);
  const [rows, setRows] = useState<RowValueState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && reportId) {
      loadSheet(reportId);
    } else {
      setSheet(null);
      setRows([]);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, reportId]);

  const loadSheet = async (id: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await resultService.getResultSheet(id);
      setSheet(data);
      const initialRows: RowValueState[] = data.values.map((v) => ({
        parameter_id: v.parameter_id,
        parameter_name: v.parameter_name,
        parameter_code: v.parameter_code,
        unit: v.unit || '',
        reference_range_display: v.reference_range_display || '—',
        numeric_value: v.numeric_value !== null && v.numeric_value !== undefined ? String(v.numeric_value) : '',
        text_value: v.text_value || '',
        technician_comment: v.technician_comment || '',
        flag: v.flag || 'NORMAL',
      }));
      setRows(initialRows);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to load test worksheet.');
    } finally {
      setLoading(false);
    }
  };

  const handleRowChange = (index: number, field: keyof RowValueState, val: string) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSave = async (submitForReview: boolean) => {
    if (!reportId) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      submit_for_review: submitForReview,
      values: rows.map((r) => ({
        parameter_id: r.parameter_id,
        numeric_value: r.numeric_value.trim() !== '' ? parseFloat(r.numeric_value) : null,
        text_value: r.text_value.trim() !== '' ? r.text_value.trim() : null,
        technician_comment: r.technician_comment.trim() !== '' ? r.technician_comment.trim() : null,
      })),
    };

    try {
      const updated = await resultService.saveResultValues(reportId, payload);
      setSheet(updated);
      setRows(
        updated.values.map((v) => ({
          parameter_id: v.parameter_id,
          parameter_name: v.parameter_name,
          parameter_code: v.parameter_code,
          unit: v.unit || '',
          reference_range_display: v.reference_range_display || '—',
          numeric_value: v.numeric_value !== null && v.numeric_value !== undefined ? String(v.numeric_value) : '',
          text_value: v.text_value || '',
          technician_comment: v.technician_comment || '',
          flag: v.flag,
        }))
      );
      setSuccessMessage(
        submitForReview
          ? 'Results submitted for Pathologist / Reviewer sign-off.'
          : 'Draft results saved and reference ranges calculated.'
      );
      setTimeout(() => {
        onSuccess();
      }, 700);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to save results.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBadgeVariant = (flag: ResultFlag): 'normal' | 'low' | 'high' | 'critical' => {
    switch (flag) {
      case 'CRITICAL_LOW':
      case 'CRITICAL_HIGH':
        return 'critical';
      case 'LOW':
        return 'low';
      case 'HIGH':
        return 'high';
      case 'NORMAL':
      default:
        return 'normal';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Result Entry Worksheet: ${sheet?.test_name || 'Loading...'}`}
      maxWidth="2xl"
    >
      {loading ? (
        <div className="py-12 flex justify-center items-center text-slate-500">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mr-3" />
          Loading patient parameters and biological intervals...
        </div>
      ) : (
        <div className="space-y-5">
          {errorMessage && <Alert type="error">{errorMessage}</Alert>}
          {successMessage && <Alert type="success">{successMessage}</Alert>}

          {sheet && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Patient</span>
                <span className="font-semibold text-slate-800 text-sm">{sheet.patient_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Demographics</span>
                <span className="font-semibold text-slate-800">
                  {sheet.patient_gender}, {sheet.patient_age_years} Yrs
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Report Reference</span>
                <span className="font-mono font-semibold text-teal-700">{sheet.report_id_display}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Current Status</span>
                <Badge variant={sheet.status === 'FINAL' ? 'final' : sheet.status === 'PENDING_REVIEW' ? 'pending' : 'slate'}>
                  {sheet.status}
                </Badge>
              </div>
            </div>
          )}

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Analyte / Parameter</th>
                  <th className="px-4 py-3 w-40">Value</th>
                  <th className="px-3 py-3 w-20">Unit</th>
                  <th className="px-4 py-3">Biological Range</th>
                  <th className="px-3 py-3 w-28 text-center">Status Flag</th>
                  <th className="px-4 py-3">Comments</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={row.parameter_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>{row.parameter_name}</div>
                      <div className="text-xs font-mono text-slate-400">{row.parameter_code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={row.numeric_value}
                        onChange={(e) => handleRowChange(idx, 'numeric_value', e.target.value)}
                        placeholder="0.0"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-500 font-mono">
                      {row.unit || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                      {row.reference_range_display}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Badge variant={getBadgeVariant(row.flag)} dot>
                        {row.flag.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={row.technician_comment}
                        onChange={(e) => handleRowChange(idx, 'technician_comment', e.target.value)}
                        placeholder="Optional comment"
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-400">
              * Flags automatically calculated based on gender &amp; age-specific reference bounds.
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleSave(false)}
                disabled={isSubmitting || sheet?.status === 'FINAL'}
              >
                Save Draft
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSave(true)}
                disabled={isSubmitting || sheet?.status === 'FINAL'}
              >
                Submit for Sign-off
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
