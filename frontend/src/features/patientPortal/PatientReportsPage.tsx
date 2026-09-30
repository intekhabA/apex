import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Badge, Alert, Modal } from '@/components/ui';
import { patientPortalService } from '@/api/patientPortalService';
import { ReportListItem, ReportDetail } from '@/types/report';
import {
  FileCheck2,
  Download,
  Search,
  Clock,
  Eye,
  ShieldCheck,
  FileText,
} from 'lucide-react';

export const PatientReportsPage: React.FC = () => {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingBookingId, setDownloadingBookingId] = useState<string | null>(null);

  // Detail Modal State
  const [detailReport, setDetailReport] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleDownloadBookingAll = async (
    bookingId: string,
    bookingDisplayId: string,
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setDownloadingBookingId(bookingId);
    try {
      await patientPortalService.downloadBookingAllReportsPdf(
        bookingId,
        `Booking_${bookingDisplayId}_All_Reports.pdf`
      );
    } catch {
      alert('Consolidated booking report PDF could not be downloaded.');
    } finally {
      setDownloadingBookingId(null);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await patientPortalService.getReports();
      setReports(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to fetch medical reports.');
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const s = search.toLowerCase();
      return (
        search === '' ||
        r.test_name.toLowerCase().includes(s) ||
        r.report_id_display.toLowerCase().includes(s) ||
        r.test_code.toLowerCase().includes(s)
      );
    });
  }, [reports, search]);

  const handleDownload = async (
    r: { id: string; report_id_display: string; test_name: string },
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();
    setDownloadingId(r.id);
    try {
      await patientPortalService.downloadReportPdf(
        r.id,
        `${r.report_id_display}_${r.test_name.replace(/\s+/g, '_')}.pdf`
      );
    } catch {
      alert('Report PDF could not be downloaded.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleOpenDetail = async (reportId: string) => {
    setIsModalOpen(true);
    setDetailLoading(true);
    try {
      const detail = await patientPortalService.getReportDetail(reportId);
      setDetailReport(detail);
    } catch {
      alert('Unable to load report details.');
      setIsModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileCheck2 className="w-6 h-6 text-teal-600" />
            My Diagnostic Reports
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Access, view, and securely download your official medical diagnostic test reports.
          </p>
        </div>
      </div>

      {errorMessage && (
        <Alert type="error" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Search Bar */}
      <Card className="p-4 bg-white border border-slate-200">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by test name, test code, or report #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {/* Reports Listing */}
      <Card className="overflow-hidden border border-slate-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading medical reports...</div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No medical reports found</p>
            <p className="text-xs text-slate-400 mt-1">
              Finalized diagnostic reports from your visits will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Report #</th>
                  <th className="p-3.5">Diagnostic Test</th>
                  <th className="p-3.5">Sample / Modality</th>
                  <th className="p-3.5">Finalized Date</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => handleOpenDetail(r.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 font-semibold text-teal-700">
                      {r.report_id_display}
                      <span className="block text-[11px] text-slate-400 font-normal">
                        v{r.current_version}.0
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-medium text-slate-900">{r.test_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{r.test_code}</div>
                    </td>
                    <td className="p-3.5 text-slate-600 text-xs">
                      {r.sample_type || 'Clinical Specimen'}
                    </td>
                    <td className="p-3.5 text-slate-600 text-xs">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {r.finalized_at
                          ? new Date(r.finalized_at).toLocaleDateString()
                          : new Date(r.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-3.5 text-center">
                      <Badge variant="normal">Final & Sealed</Badge>
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(r.id);
                        }}
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={(e) => handleDownload(r, e)}
                        isLoading={downloadingId === r.id}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Report Detail Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          detailReport
            ? `${detailReport.test_name} — ${detailReport.report_id_display}`
            : 'Diagnostic Report'
        }
        maxWidth="xl"
      >
        {detailLoading || !detailReport ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading report details...</div>
        ) : (
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-xs text-slate-500 block uppercase font-medium">Test</span>
                <span className="font-semibold text-slate-900">{detailReport.test_name}</span>
                <span className="text-xs text-slate-400 block font-mono">{detailReport.test_code}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block uppercase font-medium">Laboratory</span>
                <span className="font-semibold text-slate-800">{detailReport.lab_name}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block uppercase font-medium">Status</span>
                <Badge variant="normal">Finalized & Sealed</Badge>
              </div>
              <div>
                <span className="text-xs text-slate-500 block uppercase font-medium">Version</span>
                <span className="font-semibold text-slate-800">v{detailReport.current_version}.0</span>
              </div>
            </div>

            {/* Pathology Analyte Results Table */}
            {detailReport.result_values && detailReport.result_values.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-800">
                  Observed Clinical Results ({detailReport.result_values.length})
                </h4>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                      <tr>
                        <th className="p-2.5">Parameter</th>
                        <th className="p-2.5 text-right">Result</th>
                        <th className="p-2.5">Unit</th>
                        <th className="p-2.5">Reference Range</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailReport.result_values.map((v) => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="p-2.5 font-medium text-slate-800">{v.parameter_name}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">
                            {v.numeric_value !== null ? v.numeric_value : v.text_value || '—'}
                          </td>
                          <td className="p-2.5 text-slate-500">{v.unit || '—'}</td>
                          <td className="p-2.5 text-slate-600">{v.reference_range_display || '—'}</td>
                          <td className="p-2.5 text-center">
                            <Badge
                              variant={
                                v.flag === 'NORMAL'
                                  ? 'normal'
                                  : v.flag === 'CRITICAL_HIGH' || v.flag === 'CRITICAL_LOW'
                                  ? 'critical'
                                  : 'low'
                              }
                            >
                              {v.flag}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Narrative / Imaging Findings */}
            {(detailReport.clinical_history ||
              detailReport.imaging_findings ||
              detailReport.imaging_impression) && (
              <div className="space-y-4 border rounded-lg p-4 bg-slate-50/60">
                {detailReport.clinical_history && (
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 uppercase">Clinical History</h5>
                    <p className="text-xs text-slate-800 mt-1">{detailReport.clinical_history}</p>
                  </div>
                )}
                {detailReport.imaging_findings && (
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 uppercase">Findings</h5>
                    <p className="text-xs text-slate-800 mt-1 whitespace-pre-line">
                      {detailReport.imaging_findings}
                    </p>
                  </div>
                )}
                {detailReport.imaging_impression && (
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 uppercase">Impression</h5>
                    <p className="text-xs text-slate-900 font-semibold mt-1">
                      {detailReport.imaging_impression}
                    </p>
                  </div>
                )}
                {detailReport.recommendations && (
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 uppercase">Recommendations</h5>
                    <p className="text-xs text-slate-700 mt-1">{detailReport.recommendations}</p>
                  </div>
                )}
              </div>
            )}

            {/* Security & Verification Stamp */}
            <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between text-xs text-teal-900">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                <span>
                  Electronically certified report with HMAC-SHA256 tamper-proof verification.
                </span>
              </div>
              {detailReport.approved_by_name && (
                <span className="font-semibold">Approved by: {detailReport.approved_by_name}</span>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
              {detailReport.booking_id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleDownloadBookingAll(
                      detailReport.booking_id,
                      detailReport.booking_id_display || detailReport.booking_id
                    )
                  }
                  isLoading={downloadingBookingId === detailReport.booking_id}
                  className="text-teal-700 border-teal-300 hover:bg-teal-50 text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  All Reports in Booking (PDF)
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                  Close
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleDownload(detailReport)}
                  isLoading={downloadingId === detailReport.id}
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download This Report PDF
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
