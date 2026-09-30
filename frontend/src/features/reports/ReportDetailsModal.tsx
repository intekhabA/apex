import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert, Badge } from '@/components/ui';
import { reportService } from '@/api/reportService';
import { ReportDetail, ResultFlag } from '@/types';
import {
  Download,
  FileCheck2,
  Lock,
  History,
  ExternalLink,
  ShieldCheck,
  FileImage,
  RefreshCw,
} from 'lucide-react';
import { ReportAmendModal } from './ReportAmendModal';

export interface ReportDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reportId: string | null;
}

export const ReportDetailsModal: React.FC<ReportDetailsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  reportId,
}) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Amend Modal State
  const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen && reportId) {
      loadReport(reportId);
    } else {
      setReport(null);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, reportId]);

  const loadReport = async (id: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await reportService.getReportDetail(id);
      setReport(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to load report details.');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!reportId) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const updated = await reportService.approveReport(reportId);
      setReport(updated);
      setSuccessMessage('Medical report approved by pathologist.');
      onSuccess();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to approve report.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!reportId) return;
    setIsActionLoading(true);
    setErrorMessage(null);
    try {
      const updated = await reportService.finalizeReport(reportId);
      setReport(updated);
      setSuccessMessage('Report sealed! Cryptographic HMAC generated & PDF created.');
      onSuccess();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to finalize report.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!report) return;
    try {
      await reportService.downloadReportPdf(
        report.id,
        `${report.report_id_display}_v${report.current_version}.pdf`
      );
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to download report PDF.');
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
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Diagnostic Medical Report: ${report?.report_id_display || 'Loading...'}`}
        maxWidth="2xl"
      >
        {loading ? (
          <div className="py-12 flex justify-center items-center text-slate-500">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mr-3" />
            Loading authentic medical report records...
          </div>
        ) : (
          <div className="space-y-6">
            {errorMessage && <Alert type="error">{errorMessage}</Alert>}
            {successMessage && <Alert type="success">{successMessage}</Alert>}

            {report && (
              <>
                {/* Header Demographics */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Patient</span>
                    <span className="font-semibold text-slate-800 text-sm">{report.patient_name}</span>
                    <span className="text-slate-400 block font-mono text-[11px]">{report.patient_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Demographics</span>
                    <span className="font-semibold text-slate-800">
                      {report.patient_gender}, {report.patient_age_years} Yrs
                    </span>
                    <span className="text-slate-400 block">Ref: {report.booking_id_display}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Test &amp; Version</span>
                    <span className="font-semibold text-slate-800">{report.test_name}</span>
                    <span className="text-teal-700 block font-semibold">Version {report.current_version}.0</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Status</span>
                    <Badge variant={report.status === 'FINAL' ? 'final' : report.status === 'APPROVED' ? 'teal' : report.status === 'PENDING_REVIEW' ? 'pending' : 'slate'}>
                      {report.status}
                    </Badge>
                    {report.is_immutable && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                        <Lock className="w-3 h-3 text-slate-400" /> Sealed &amp; Locked
                      </span>
                    )}
                  </div>
                </div>

                {/* Pathology Analytes Table */}
                {report.result_values.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Pathology Panel Findings
                    </h3>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-sm text-slate-700">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-2.5">Analyte</th>
                            <th className="px-4 py-2.5">Observed Value</th>
                            <th className="px-3 py-2.5">Unit</th>
                            <th className="px-4 py-2.5">Biological Range</th>
                            <th className="px-3 py-2.5 text-center">Status Flag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.result_values.map((v) => (
                            <tr key={v.parameter_id} className="hover:bg-slate-50/70">
                              <td className="px-4 py-2.5 font-medium text-slate-900">
                                <div>{v.parameter_name}</div>
                                <div className="text-xs font-mono text-slate-400">{v.parameter_code}</div>
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-slate-900">
                                {v.numeric_value !== null && v.numeric_value !== undefined
                                  ? v.numeric_value
                                  : v.text_value || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-slate-500 font-mono">
                                {v.unit || '—'}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-slate-600 font-mono">
                                {v.reference_range_display || '—'}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <Badge variant={getBadgeVariant(v.flag)} dot>
                                  {v.flag.replace('_', ' ')}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Radiology Narrative Section */}
                {(report.imaging_findings || report.clinical_history || report.imaging_impression) && (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                    {report.clinical_history && (
                      <div>
                        <span className="font-bold text-slate-700 block uppercase tracking-wider mb-0.5">
                          Clinical History:
                        </span>
                        <p className="text-slate-600 font-sans">{report.clinical_history}</p>
                      </div>
                    )}
                    {report.imaging_findings && (
                      <div>
                        <span className="font-bold text-slate-700 block uppercase tracking-wider mb-0.5">
                          Imaging Findings:
                        </span>
                        <pre className="text-slate-700 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                          {report.imaging_findings}
                        </pre>
                      </div>
                    )}
                    {report.imaging_impression && (
                      <div>
                        <span className="font-bold text-slate-700 block uppercase tracking-wider mb-0.5">
                          Impression:
                        </span>
                        <p className="text-slate-900 font-semibold">{report.imaging_impression}</p>
                      </div>
                    )}
                    {report.recommendations && (
                      <div>
                        <span className="font-bold text-slate-700 block uppercase tracking-wider mb-0.5">
                          Recommendations:
                        </span>
                        <p className="text-slate-600">{report.recommendations}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Attachments */}
                {report.attachments.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <FileImage className="w-4 h-4 text-teal-600" />
                      Diagnostic Scan Attachments ({report.attachments.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {report.attachments.map((att) => (
                        <div key={att.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2.5">
                          <FileImage className="w-5 h-5 text-teal-600 shrink-0" />
                          <div className="truncate">
                            <span className="font-medium text-slate-800 block truncate">{att.file_name}</span>
                            <span className="text-slate-400 font-mono text-[10px]">
                              {(att.file_size_bytes / 1024).toFixed(1)} KB • {att.caption || 'No caption'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Digital Signature & Approver Card */}
                {report.approved_by_name && (
                  <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-teal-900 block">
                          Digitally Authenticated by {report.approved_by_name}
                        </span>
                        <span className="text-teal-700 font-mono text-[10px]">
                          HMAC Digest: {report.hmac_digest ? `${report.hmac_digest.slice(0, 16)}...${report.hmac_digest.slice(-8)}` : 'Generating...'}
                        </span>
                      </div>
                    </div>
                    {report.verification_token && (
                      <a
                        href={`/verify/${report.verification_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-700 hover:text-teal-900 font-semibold inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded border border-teal-200 shadow-sm transition-colors"
                      >
                        <span>Verify QR</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                {/* Version History */}
                {report.versions.length > 0 && (
                  <div className="space-y-2 border-t border-slate-200 pt-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <History className="w-4 h-4 text-slate-500" />
                      Prior Report Versions ({report.versions.length})
                    </h3>
                    <div className="space-y-1.5">
                      {report.versions.map((ver) => (
                        <div
                          key={ver.id}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex justify-between items-center"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">
                              Version {ver.version_number}.0 Snapshot
                            </span>
                            <span className="text-slate-400 ml-2 font-mono text-[10px]">
                              {new Date(ver.created_at).toLocaleDateString()} by {ver.amended_by_name || 'Staff'}
                            </span>
                            <p className="text-slate-600 mt-0.5 text-[11px] italic">
                              &ldquo;{ver.amendment_reason}&rdquo;
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap justify-between items-center pt-4 border-t border-slate-100 gap-2">
                  <Button variant="secondary" onClick={onClose}>
                    Close
                  </Button>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Approve Action */}
                    {(report.status === 'PENDING_REVIEW' || report.status === 'DRAFT') && (
                      <Button
                        variant="primary"
                        onClick={handleApprove}
                        disabled={isActionLoading}
                        className="flex items-center gap-1.5"
                      >
                        <FileCheck2 className="w-4 h-4" />
                        <span>{isActionLoading ? 'Signing...' : 'Approve & Sign Off'}</span>
                      </Button>
                    )}

                    {/* Finalize Action */}
                    {report.status === 'APPROVED' && (
                      <Button
                        variant="primary"
                        onClick={handleFinalize}
                        disabled={isActionLoading}
                        className="flex items-center gap-1.5"
                      >
                        <Lock className="w-4 h-4" />
                        <span>{isActionLoading ? 'Sealing PDF...' : 'Finalize & Generate PDF'}</span>
                      </Button>
                    )}

                    {/* Download PDF Action */}
                    {report.status === 'FINAL' && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => setIsAmendModalOpen(true)}
                          className="flex items-center gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Amend Report</span>
                        </Button>
                        <Button
                          variant="primary"
                          onClick={handleDownload}
                          className="flex items-center gap-1.5"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download PDF</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Versioned Amendment Modal */}
      {report && (
        <ReportAmendModal
          isOpen={isAmendModalOpen}
          onClose={() => setIsAmendModalOpen(false)}
          onSuccess={() => {
            setIsAmendModalOpen(false);
            loadReport(report.id);
            onSuccess();
          }}
          reportId={report.id}
          reportDisplayId={report.report_id_display}
          currentVersion={report.current_version}
        />
      )}
    </>
  );
};
