import React, { useState, useEffect, useMemo } from 'react';
import { Button, Input, Badge, Alert } from '@/components/ui';
import { resultService } from '@/api/resultService';
import { PendingWorklistReport, ReportStatus } from '@/types';
import { ResultEntryModal } from './ResultEntryModal';
import { ImagingReportEditorModal } from '@/features/imaging/ImagingReportEditorModal';

export const ResultsWorklistPage: React.FC = () => {
  const [reports, setReports] = useState<PendingWorklistReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PENDING_REVIEW'>('ALL');

  // Modal State
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedImagingReportId, setSelectedImagingReportId] = useState<string | null>(null);
  const [isImagingModalOpen, setIsImagingModalOpen] = useState(false);

  const fetchWorklist = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await resultService.getPendingWorklist();
      setReports(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to fetch results worklist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorklist();
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

  const handleOpenEntry = (report: PendingWorklistReport) => {
    if (report.sample_type === 'IMAGING') {
      setSelectedImagingReportId(report.report_id);
      setIsImagingModalOpen(true);
    } else {
      setSelectedReportId(report.report_id);
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedReportId(null);
    setIsImagingModalOpen(false);
    setSelectedImagingReportId(null);
  };

  const handleSuccess = () => {
    handleCloseModal();
    fetchWorklist();
  };

  const getStatusBadge = (status: ReportStatus) => {
    switch (status) {
      case 'DRAFT':
        return <Badge variant="slate">Draft</Badge>;
      case 'PENDING_REVIEW':
        return <Badge variant="pending">Pending Review</Badge>;
      case 'APPROVED':
      case 'FINAL':
        return <Badge variant="final">Signed Off</Badge>;
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
            Results Entry Worklist
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Input analyte values, review automatic biological reference flags, and submit for sign-off.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={fetchWorklist} disabled={loading}>
            Refresh Worklist
          </Button>
        </div>
      </div>

      {errorMessage && <Alert type="error">{errorMessage}</Alert>}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-80">
          <Input
            placeholder="Search by patient, test, report ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Status:
          </span>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            {(['ALL', 'DRAFT', 'PENDING_REVIEW'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  statusFilter === s
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'ALL' ? 'All' : s === 'DRAFT' ? 'Draft' : 'Pending Review'}
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
            Loading results worklist...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No diagnostic tests currently awaiting result entry matching your filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Report ID</th>
                  <th className="px-6 py-3">Booking ID</th>
                  <th className="px-6 py-3">Patient</th>
                  <th className="px-6 py-3">Diagnostic Test</th>
                  <th className="px-6 py-3">Specimen</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report) => (
                  <tr key={report.report_id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono font-semibold text-teal-700">
                      {report.report_id_display}
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-600 text-xs">
                      {report.booking_id_display || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{report.patient_name}</div>
                      <div className="text-xs font-mono text-slate-400">
                        {report.patient_id_display}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{report.test_name}</div>
                      <div className="text-xs font-mono text-slate-400">{report.test_code}</div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-600">
                      {report.sample_type.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(report.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        size="sm"
                        variant={report.sample_type === 'IMAGING' ? 'secondary' : 'primary'}
                        onClick={() => handleOpenEntry(report)}
                      >
                        {report.sample_type === 'IMAGING' ? 'Radiology Report' : 'Enter Results'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pathology / Biochemistry Entry Modal */}
      <ResultEntryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        reportId={selectedReportId}
      />

      {/* Radiology / Imaging Reporting Modal */}
      <ImagingReportEditorModal
        isOpen={isImagingModalOpen}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
        reportId={selectedImagingReportId}
      />
    </div>
  );
};
