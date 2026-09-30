import React, { useState, useEffect, useMemo } from 'react';
import { Button, Input, Badge, Alert } from '@/components/ui';
import { reportService } from '@/api/reportService';
import { ReportListItem, ReportStatus } from '@/types';
import { Download, FileCheck2 } from 'lucide-react';
import { ReportDetailsModal } from './ReportDetailsModal';

export const ReportsListPage: React.FC = () => {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReportStatus>('ALL');

  // Modal State
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await reportService.getReports();
      setReports(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to fetch medical reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const matchesSearch =
        search === '' ||
        r.report_id_display.toLowerCase().includes(search.toLowerCase()) ||
        r.patient_name.toLowerCase().includes(search.toLowerCase()) ||
        r.patient_id_display.toLowerCase().includes(search.toLowerCase()) ||
        r.test_name.toLowerCase().includes(search.toLowerCase()) ||
        r.booking_id_display.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [reports, search, statusFilter]);

  const handleOpenDetails = (reportId: string) => {
    setSelectedReportId(reportId);
    setIsModalOpen(true);
  };

  const handleDownloadPdf = async (report: ReportListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await reportService.downloadReportPdf(
        report.id,
        `${report.report_id_display}_v${report.current_version}.pdf`
      );
    } catch {
      alert('PDF not available for this report.');
    }
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="slate">Draft</Badge>;
      case 'PENDING_REVIEW':
        return <Badge variant="pending">Pending Sign-off</Badge>;
      case 'APPROVED':
        return <Badge variant="teal">Approved</Badge>;
      case 'FINAL':
        return <Badge variant="final">Finalized / Sealed</Badge>;
      case 'CANCELLED':
        return <Badge variant="critical">Cancelled</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Medical Reports &amp; Digital Approvals
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pathologist and radiologist sign-off workflow, versioned amendments, and tamper-proof PDF generation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={fetchReports} disabled={loading}>
            Refresh Reports
          </Button>
        </div>
      </div>

      {errorMessage && <Alert type="error">{errorMessage}</Alert>}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-80">
          <Input
            placeholder="Search report ID, patient, test..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">
            Status:
          </span>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {(['ALL', 'PENDING_REVIEW', 'APPROVED', 'FINAL', 'DRAFT'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors shrink-0 ${
                  statusFilter === s
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'ALL'
                  ? 'All'
                  : s === 'PENDING_REVIEW'
                  ? 'Pending Review'
                  : s === 'APPROVED'
                  ? 'Approved'
                  : s === 'FINAL'
                  ? 'Final'
                  : 'Draft'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading diagnostic reports...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No diagnostic reports found matching your selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Report ID</th>
                  <th className="px-6 py-3">Patient</th>
                  <th className="px-6 py-3">Diagnostic Test</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Signatory</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    onClick={() => handleOpenDetails(report.id)}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-mono font-semibold text-teal-700">
                      <div>{report.report_id_display}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {report.booking_id_display}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{report.patient_name}</div>
                      <div className="text-xs font-mono text-slate-400">
                        {report.patient_id_display}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{report.test_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{report.test_code}</div>
                    </td>
                    <td className="px-4 py-4 text-xs font-semibold text-slate-700 font-mono">
                      v{report.current_version}.0
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {report.approved_by_name ? (
                        <div className="flex items-center gap-1 text-teal-800 font-medium">
                          <FileCheck2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>{report.approved_by_name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Awaiting Sign-off</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleOpenDetails(report.id)}
                        >
                          Details
                        </Button>
                        {report.status === 'FINAL' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={(e) => handleDownloadPdf(report, e)}
                            className="flex items-center gap-1"
                            title="Download Official Sealed PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>PDF</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ReportDetailsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedReportId(null);
        }}
        onSuccess={() => {
          fetchReports();
        }}
        reportId={selectedReportId}
      />
    </div>
  );
};
