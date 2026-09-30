import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Badge } from '@/components/ui';
import { imagingService } from '@/api/imagingService';
import { ImagingReport, ImagingTemplate } from '@/types';
import { Upload, Trash2, FileImage, Sparkles } from 'lucide-react';

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

  // Form State
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [imagingFindings, setImagingFindings] = useState('');
  const [imagingImpression, setImagingImpression] = useState('');
  const [recommendations, setRecommendations] = useState('');

  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && reportId) {
      loadData(reportId);
    } else {
      setReport(null);
      setClinicalHistory('');
      setImagingFindings('');
      setImagingImpression('');
      setRecommendations('');
      setSelectedFile(null);
      setCaption('');
      setErrorMessage(null);
      setSuccessMessage(null);
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
      setClinicalHistory(reportData.clinical_history || '');
      setImagingFindings(reportData.imaging_findings || '');
      setImagingImpression(reportData.imaging_impression || '');
      setRecommendations(reportData.recommendations || '');
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
    setClinicalHistory(tpl.clinical_history_template);
    setImagingFindings(tpl.findings_template);
    setImagingImpression(tpl.impression_template);
    setRecommendations(tpl.recommendations_template);
  };

  const handleUploadScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportId || !selectedFile) return;

    setIsUploading(true);
    setErrorMessage(null);
    try {
      await imagingService.uploadAttachment(reportId, selectedFile, caption);
      // Reload attachments
      const fresh = await imagingService.getImagingReport(reportId);
      setReport(fresh);
      setSelectedFile(null);
      setCaption('');
      setSuccessMessage('Scan attached successfully.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to upload scan attachment.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!reportId) return;
    try {
      await imagingService.deleteAttachment(reportId, attachmentId);
      const fresh = await imagingService.getImagingReport(reportId);
      setReport(fresh);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to delete attachment.');
    }
  };

  const handleSave = async (submitForReview: boolean) => {
    if (!reportId) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      clinical_history: clinicalHistory.trim() || null,
      imaging_findings: imagingFindings.trim() || null,
      imaging_impression: imagingImpression.trim() || null,
      recommendations: recommendations.trim() || null,
      submit_for_review: submitForReview,
    };

    try {
      const updated = await imagingService.updateImagingReport(reportId, payload);
      setReport(updated);
      setSuccessMessage(
        submitForReview
          ? 'Radiology report submitted for approval sign-off.'
          : 'Radiology report draft saved successfully.'
      );
      setTimeout(() => {
        onSuccess();
      }, 700);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to update imaging report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Radiology Reporting: ${report?.test_name || 'Loading...'}`}
      maxWidth="2xl"
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
                className="w-full sm:w-64 px-3 py-1.5 text-xs bg-white border border-teal-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              >
                <option value="">Select a Clinical Template...</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.modality}] {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Structured Textareas */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Clinical History &amp; Indication
              </label>
              <textarea
                rows={2}
                value={clinicalHistory}
                onChange={(e) => setClinicalHistory(e.target.value)}
                placeholder="Indication for imaging study..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Imaging Findings (Organ-by-Organ / Anatomic Structure)
              </label>
              <textarea
                rows={6}
                value={imagingFindings}
                onChange={(e) => setImagingFindings(e.target.value)}
                placeholder="Structured anatomical observations..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-xs leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Radiological Impression / Conclusion
                </label>
                <textarea
                  rows={3}
                  value={imagingImpression}
                  onChange={(e) => setImagingImpression(e.target.value)}
                  placeholder="Primary diagnostic impression..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Recommendations &amp; Advice
                </label>
                <textarea
                  rows={3}
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  placeholder="Clinical advice, follow-up, or correlation..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 font-sans"
                />
              </div>
            </div>
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
                      <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                        <FileImage className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <div className="font-semibold text-slate-800 truncate">{att.file_name}</div>
                        <div className="text-slate-400 font-mono text-[10px]">
                          {(att.file_size_bytes / 1024).toFixed(1)} KB • {att.caption || 'No caption'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(att.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors ml-2"
                      title="Delete attachment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload New Attachment Form */}
            <form onSubmit={handleUploadScan} className="bg-slate-50 p-3 rounded-xl border border-dashed border-slate-300 flex flex-col sm:flex-row items-center gap-3">
              <input
                type="file"
                accept="image/*,.pdf,.dcm"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
              />
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Optional scan caption..."
                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={!selectedFile || isUploading}
                className="shrink-0 flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploading ? 'Uploading...' : 'Attach Scan'}</span>
              </Button>
            </form>
          </div>

          {/* Action Footer */}
          <div className="flex justify-between items-center pt-3 border-t border-slate-100">
            <div className="text-xs text-slate-400">
              * Findings and impressions are recorded under the radiologist&apos;s digital audit identity.
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleSave(false)}
                disabled={isSubmitting || report?.status === 'FINAL'}
              >
                Save Draft
              </Button>
              <Button
                variant="primary"
                onClick={() => handleSave(true)}
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
