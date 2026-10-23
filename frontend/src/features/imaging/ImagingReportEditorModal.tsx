import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Badge, toast, confirmDialog, RichTextEditor } from '@/components/ui';
import { imagingService } from '@/api/imagingService';
import { ImagingReport, ImagingTemplate } from '@/types';
import { Upload, Trash2, FileImage, Sparkles, FileText } from 'lucide-react';

export interface ImagingReportEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reportId: string | null;
}

export const ImagingReportEditorModal: React.FC<ImagingReportEditorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  reportId,
}) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ImagingReport | null>(null);
  const [templates, setTemplates] = useState<ImagingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  // Form State: Unified Single Box Editor
  const [reportContent, setReportContent] = useState('');

  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Helpers to combine sections into one rich-text box
  const combineReportToHtml = (rep: ImagingReport): string => {
    if (rep.imaging_findings && /<[a-z][\s\S]*>/i.test(rep.imaging_findings)) {
      return rep.imaging_findings;
    }
    const parts: string[] = [];
    if (rep.clinical_history?.trim()) {
      parts.push(
        `<div><b>CLINICAL HISTORY &amp; INDICATION:</b></div><div>${rep.clinical_history.replace(/\n/g, '<br/>')}</div>`
      );
    }
    if (rep.imaging_findings?.trim()) {
      parts.push(
        `<div><b>OBSERVATIONS &amp; FINDINGS:</b></div><div>${rep.imaging_findings.replace(/\n/g, '<br/>')}</div>`
      );
    }
    if (rep.imaging_impression?.trim()) {
      parts.push(
        `<div><b>IMPRESSION:</b></div><div><b>${rep.imaging_impression.replace(/\n/g, '<br/>')}</b></div>`
      );
    }
    if (rep.recommendations?.trim()) {
      parts.push(
        `<div><b>RECOMMENDATIONS &amp; ADVICE:</b></div><div>${rep.recommendations.replace(/\n/g, '<br/>')}</div>`
      );
    }
    return parts.length > 0 ? parts.join('<div><br/></div>') : rep.imaging_findings || '';
  };

  const combineTemplateToHtml = (tpl: ImagingTemplate): string => {
    if (tpl.findings_template && /<[a-z][\s\S]*>/i.test(tpl.findings_template)) {
      return tpl.findings_template;
    }
    const parts: string[] = [];
    if (tpl.clinical_history_template?.trim()) {
      parts.push(
        `<div><b>CLINICAL HISTORY &amp; INDICATION:</b></div><div>${tpl.clinical_history_template.replace(/\n/g, '<br/>')}</div>`
      );
    }
    if (tpl.findings_template?.trim()) {
      parts.push(
        `<div><b>OBSERVATIONS &amp; FINDINGS:</b></div><div>${tpl.findings_template.replace(/\n/g, '<br/>')}</div>`
      );
    }
    if (tpl.impression_template?.trim()) {
      parts.push(
        `<div><b>IMPRESSION:</b></div><div><b>${tpl.impression_template.replace(/\n/g, '<br/>')}</b></div>`
      );
    }
    if (tpl.recommendations_template?.trim()) {
      parts.push(
        `<div><b>RECOMMENDATIONS &amp; ADVICE:</b></div><div>${tpl.recommendations_template.replace(/\n/g, '<br/>')}</div>`
      );
    }
    return parts.length > 0 ? parts.join('<div><br/></div>') : tpl.findings_template || '';
  };

  useEffect(() => {
    if (isOpen && reportId) {
      loadData(reportId);
    } else {
      setReport(null);
      setReportContent('');
      setSelectedFile(null);
      setCaption('');
      setErrorMessage(null);
      setSuccessMessage(null);
      setSelectedTemplateId('');
    }
  }, [isOpen, reportId]);

  const loadData = async (id: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [reportData, templatesData] = await Promise.all([
        imagingService.getImagingReport(id),
        imagingService.getTemplates(),
      ]);
      setReport(reportData);
      setTemplates(templatesData);
      setReportContent(combineReportToHtml(reportData));
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to load imaging report.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplateId(templateId);
    setReportContent(combineTemplateToHtml(tpl));
  };

  const handleUploadScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportId || !selectedFile) return;

    setIsUploading(true);
    setErrorMessage(null);
    try {
      await imagingService.uploadAttachment(reportId, selectedFile, caption);
      const fresh = await imagingService.getImagingReport(reportId);
      setReport(fresh);
      setSelectedFile(null);
      setCaption('');
      toast.success('Scan attached successfully.');
      setSuccessMessage('Scan attached successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      const msg = errorObj.response?.data?.message || 'Failed to upload scan attachment.';
      toast.error(msg);
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!reportId) return;

    const confirmed = await confirmDialog({
      title: 'Delete Scan Attachment',
      message: 'Are you sure you want to delete this scan attachment? This action cannot be undone.',
      confirmText: 'Delete Attachment',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await imagingService.deleteAttachment(reportId, attachmentId);
      const fresh = await imagingService.getImagingReport(reportId);
      setReport(fresh);
      toast.success('Scan attachment deleted successfully.');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      const msg = errorObj.response?.data?.message || 'Failed to delete attachment.';
      toast.error(msg);
      setErrorMessage(msg);
    }
  };

  const handleSave = async (submitForReview: boolean) => {
    if (!reportId) return;

    if (submitForReview) {
      const confirmed = await confirmDialog({
        title: 'Submit Radiology Report for Sign-off',
        message: 'Are you sure you want to submit this radiology report for Radiologist sign-off and approval?',
        confirmText: 'Submit for Sign-off',
        variant: 'primary',
      });
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      clinical_history: null,
      imaging_findings: reportContent.trim() || null,
      imaging_impression: null,
      recommendations: null,
      submit_for_review: submitForReview,
    };

    try {
      const updated = await imagingService.updateImagingReport(reportId, payload);
      setReport(updated);
      const msg = submitForReview
        ? 'Radiology report submitted for approval sign-off.'
        : 'Radiology report draft saved successfully.';
      toast.success(msg);
      setSuccessMessage(msg);
      setTimeout(() => {
        onSuccess();
      }, 700);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      const msg = errorObj.response?.data?.message || 'Failed to update imaging report.';
      toast.error(msg);
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Radiology Reporting: ${report?.test_name || 'Loading...'}`}
      maxWidth="5xl"
    >
      {loading ? (
        <div className="py-12 flex justify-center items-center text-slate-500">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mr-3" />
          Loading radiologist narrative workspace...
        </div>
      ) : (
        <div className="space-y-6">
          {errorMessage && <Alert type="error">{errorMessage}</Alert>}
          {successMessage && <Alert type="success">{successMessage}</Alert>}

          {report && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Patient</span>
                <span className="font-semibold text-slate-800 text-sm">{report.patient_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Demographics</span>
                <span className="font-semibold text-slate-800">
                  {report.patient_gender}, {report.patient_age_years} Yrs
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Report Reference</span>
                <span className="font-mono font-semibold text-teal-700">{report.report_id_display}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Current Status</span>
                <Badge variant={report.status === 'FINAL' ? 'final' : report.status === 'PENDING_REVIEW' ? 'pending' : 'slate'}>
                  {report.status}
                </Badge>
              </div>
            </div>
          )}

          {/* Template Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-teal-50/50 p-3 rounded-xl border border-teal-100">
            <div className="flex items-center gap-2 text-teal-900 font-semibold text-xs">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span>Standard Ultrasound &amp; Radiography Templates:</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedTemplateId}
                onChange={(e) => handleApplyTemplate(e.target.value)}
                className="w-full sm:w-80 px-3 py-1.5 text-xs bg-white border border-teal-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              >
                <option value="">Select a Clinical Template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.modality}] {t.name} {t.test_code ? `· (${t.test_code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Unified One-Box Rich Text Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                Radiology &amp; Ultrasound Findings (All-in-One Formatted Editor)
              </label>
              <span className="text-xs text-slate-400">Bold text (Ctrl+B), add impressions, or insert sections</span>
            </div>

            <RichTextEditor
              value={reportContent}
              onChange={setReportContent}
              placeholder="Enter structured observations, organ findings, clinical indication, and diagnostic impression. Use bold for organ names and impressions..."
              minHeight="min-h-[350px]"
            />
          </div>

          {/* Attached Scans Gallery */}
          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <FileImage className="w-4 h-4 text-teal-600" />
              Attached Diagnostic Scans &amp; Images ({report?.attachments.length || 0})
            </h3>

            {report && report.attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {report.attachments.map((att) => (
                  <div
                    key={att.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center text-teal-800 font-bold shrink-0">
                        {att.file_type.toUpperCase().slice(0, 4)}
                      </div>
                      <div className="truncate">
                        <a
                          href={att.storage_path}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-slate-800 hover:text-teal-600 block truncate"
                        >
                          {att.file_name}
                        </a>
                        <span className="text-slate-400 text-[10px]">
                          {(att.file_size_bytes / 1024).toFixed(1)} KB {att.caption ? `· ${att.caption}` : ''}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors ml-2"
                      title="Delete attachment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Scan Form */}
            <form onSubmit={handleUploadScan} className="bg-slate-50/70 p-3.5 rounded-xl border border-dashed border-slate-300 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 cursor-pointer"
                />
                <input
                  type="text"
                  placeholder="Caption / View (e.g. Chest AP, Transverse Pelvic Scan)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="submit"
                  isLoading={isUploading}
                  disabled={!selectedFile || isUploading}
                  className="text-xs flex items-center gap-1 shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" /> Attach Scan
                </Button>
              </div>
            </form>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-200">
            <span className="text-xs text-slate-400">
              * Draft can be saved anytime. Submitting for sign-off locks edits and moves to review queue.
            </span>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleSave(false)}
                isLoading={isSubmitting}
                disabled={isSubmitting || report?.status === 'FINAL'}
              >
                Save Draft
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSave(true)}
                isLoading={isSubmitting}
                disabled={isSubmitting || report?.status === 'FINAL'}
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
