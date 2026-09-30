import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Badge, Alert } from '@/components/ui';
import { patientPortalService } from '@/api/patientPortalService';
import { PatientDashboardData } from '@/types/patientPortal';
import { ReportListItem } from '@/types/report';
import {
  FileCheck2,
  CalendarDays,
  Receipt,
  Download,
  Activity,
  Phone,
  Mail,
  MapPin,
  Clock,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export const PatientDashboardPage: React.FC = () => {
  const [data, setData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await patientPortalService.getDashboard();
      setData(res);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to load patient dashboard.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async (report: ReportListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingReportId(report.id);
    try {
      await patientPortalService.downloadReportPdf(
        report.id,
        `${report.report_id_display}_${report.test_name.replace(/\s+/g, '_')}.pdf`
      );
    } catch {
      alert('Failed to download report PDF. Please try again.');
    } finally {
      setDownloadingReportId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        Loading your diagnostic records...
      </div>
    );
  }

  const profile = data?.profile;
  const balance = Number(data?.outstanding_balance || 0);

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Alert type="error" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Patient Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-blue-700 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/20 text-teal-100 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-200" />
            Verified Patient Health Record
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome, {profile ? profile.full_name : 'Patient'}!
          </h1>
          <p className="mt-1.5 text-teal-100 text-sm max-w-xl">
            Access your finalized laboratory reports, view scheduled diagnostic appointments, and
            download verified medical invoices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link to="/patient/reports">
            <Button variant="secondary" size="md">
              <FileCheck2 className="w-4 h-4 mr-2 text-teal-700" />
              View All Reports
            </Button>
          </Link>
        </div>
      </div>

      {/* Patient Profile Demographics Card */}
      {profile && (
        <Card className="p-5 bg-white border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-lg">
                {profile.first_name[0]}
                {profile.last_name[0]}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{profile.full_name}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  Patient ID: {profile.patient_id_display}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="brand">{profile.gender}</Badge>
              <Badge variant="slate">{profile.age_years} yrs</Badge>
              {profile.blood_group && <Badge variant="teal">{profile.blood_group}</Badge>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400" />
              <span>{profile.phone}</span>
            </div>
            {profile.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{profile.email}</span>
              </div>
            )}
            {profile.address && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{profile.address}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Completed Reports
              </p>
              <h3 className="text-2xl font-bold text-teal-700 mt-1">
                {data?.completed_reports || 0}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Finalized & Sealed</p>
            </div>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-lg">
              <FileCheck2 className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Appointments
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {data?.total_bookings || 0}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Laboratory Orders</p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <CalendarDays className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Balance Due
              </p>
              <h3
                className={`text-2xl font-bold mt-1 ${
                  balance > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                ₹{balance.toFixed(2)}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {balance > 0 ? 'Payment Outstanding' : 'All Settled'}
              </p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <Receipt className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Finalized Reports */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-600" />
            Recent Diagnostic Reports
          </h2>
          <Link
            to="/patient/reports"
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1"
          >
            View All ({data?.completed_reports || 0})
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {!data?.recent_reports || data.recent_reports.length === 0 ? (
          <Card className="p-8 text-center text-slate-500 text-sm bg-white border border-slate-200">
            No finalized reports available yet. Once your samples are processed and approved by the
            clinical pathologist, your official signed reports will appear here.
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.recent_reports.map((r) => (
              <Card
                key={r.id}
                className="p-5 bg-white border border-slate-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-base text-slate-900">{r.test_name}</span>
                      <Badge variant="normal">Sealed</Badge>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">
                      Report #: {r.report_id_display} • Version {r.current_version}.0
                    </p>
                    <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Finalized:{' '}
                      {r.finalized_at
                        ? new Date(r.finalized_at).toLocaleDateString()
                        : new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="primary"
                    onClick={(e) => handleDownloadReport(r, e)}
                    isLoading={downloadingReportId === r.id}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Download PDF
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Appointments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            Recent Appointments & Orders
          </h2>
          <Link
            to="/patient/bookings"
            className="text-xs font-semibold text-blue-700 hover:text-blue-800 flex items-center gap-1"
          >
            View All ({data?.total_bookings || 0})
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {!data?.recent_bookings || data.recent_bookings.length === 0 ? (
          <Card className="p-8 text-center text-slate-500 text-sm bg-white border border-slate-200">
            No booking records found.
          </Card>
        ) : (
          <Card className="overflow-hidden bg-white border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                <tr>
                  <th className="p-3">Booking #</th>
                  <th className="p-3">Appointment Date</th>
                  <th className="p-3">Tests Ordered</th>
                  <th className="p-3 text-right">Total (₹)</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_bookings.map((bk) => (
                  <tr key={bk.id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-blue-700">{bk.booking_id_display}</td>
                    <td className="p-3 text-slate-600">
                      {bk.appointment_date} {bk.appointment_time || ''}
                    </td>
                    <td className="p-3 text-slate-800 font-medium">
                      {bk.items.map((it: { item_name: string }) => it.item_name).join(', ') || 'Diagnostic Test'}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      ₹{Number(bk.grand_total).toFixed(2)}
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={
                          bk.status === 'COMPLETED'
                            ? 'normal'
                            : bk.status === 'CANCELLED'
                            ? 'high'
                            : 'pending'
                        }
                      >
                        {bk.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
};
