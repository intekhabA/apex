import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Badge, Alert, Button } from '@/components/ui';
import { dashboardService } from '@/api/dashboardService';
import { LabDashboardData } from '@/types/dashboard';
import { useAuth } from '@/hooks/useAuth';
import {
  CalendarDays,
  Pipette,
  FileCheck2,
  Receipt,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export const LabAdminDashboardView: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<LabDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await dashboardService.getLabDashboard();
      setData(res);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to load laboratory analytics.');
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Loading laboratory operations...</div>;
  }

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Alert type="error" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Lab Staff Header Banner */}
      <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-teal-700 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/20 text-brand-100 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-200" />
            Active Clinical Workstation Session
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {getGreeting()}, {user?.first_name || 'Team Member'}!
          </h1>
          <p className="mt-1.5 text-brand-100 text-sm max-w-xl">
            {user?.lab_name || 'Laboratory Operations'} — Live throughput, specimen accessioning, and diagnostic reporting workflow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/results">
            <Button variant="secondary" size="md">
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-brand-700" />
              Enter Results
            </Button>
          </Link>
          <Link to="/bookings">
            <Button variant="outline" size="md" className="bg-white/10 text-white border-white/20 hover:bg-white/20">
              <CalendarDays className="w-4 h-4 mr-1.5" />
              New Order
            </Button>
          </Link>
        </div>
      </div>

      {/* Operational KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Bookings */}
        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Today's Bookings
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {data?.today_bookings_count || 0}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Total Orders: {data?.total_bookings_count || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <CalendarDays className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Specimen Accessioning */}
        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Samples in Lab
              </p>
              <h3 className="text-2xl font-bold text-teal-700 mt-1">
                {data?.samples_in_lab || 0}
              </h3>
              <p className="text-xs text-amber-600 font-medium mt-0.5">
                {data?.samples_pending_collection || 0} Pending Collection
              </p>
            </div>
            <div className="p-3 bg-teal-50 text-teal-600 rounded-lg">
              <Pipette className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Clinical Reports */}
        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Completed Reports
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                {data?.reports_completed || 0}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {data?.reports_draft || 0} Under Review / Draft
              </p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileCheck2 className="w-6 h-6" />
            </div>
          </div>
        </Card>

        {/* Financial Throughput */}
        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Collections Today
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                ₹{Number(data?.revenue_today || 0).toFixed(2)}
              </h3>
              <p className="text-xs text-amber-600 font-medium mt-0.5">
                Due: ₹{Number(data?.outstanding_receivables || 0).toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <Receipt className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Revenue & Volume Trend */}
        <Card className="p-5 bg-white border border-slate-200 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                7-Day Daily Collections & Throughput
              </h3>
              <p className="text-xs text-slate-500">Daily gross revenue collections in INR</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.daily_trends || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="labColorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  formatter={(val: unknown) => [`₹${Number(val).toFixed(2)}`, 'Revenue']}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#0d9488" strokeWidth={2.5} fillOpacity={1} fill="url(#labColorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Specimen Status Breakdown */}
        <Card className="p-5 bg-white border border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Pipette className="w-4 h-4 text-blue-600" />
                Sample Pipeline
              </h3>
              <p className="text-xs text-slate-500">Accessioning state distribution</p>
            </div>
          </div>

          <div className="h-64 w-full">
            {!data?.sample_status_breakdown || data.sample_status_breakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No samples recorded yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.sample_status_breakdown}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {data.sample_status_breakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Operational Worklists Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="overflow-hidden border border-slate-200 bg-white">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-600" />
              Recent Patient Orders
            </h3>
            <Link to="/bookings">
              <Button size="sm" variant="ghost">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                <tr>
                  <th className="p-3">Booking #</th>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-right">Grand Total</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.recent_bookings || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400">
                      No recent bookings
                    </td>
                  </tr>
                ) : (
                  (data?.recent_bookings || []).map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-blue-700">{b.booking_id_display}</td>
                      <td className="p-3 text-slate-600">{b.booking_date}</td>
                      <td className="p-3 text-right font-medium text-slate-900">
                        ₹{Number(b.grand_total).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant={
                            b.status === 'COMPLETED'
                              ? 'normal'
                              : b.status === 'CANCELLED'
                              ? 'high'
                              : 'brand'
                          }
                        >
                          {b.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Diagnostic Reports */}
        <Card className="overflow-hidden border border-slate-200 bg-white">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              Latest Medical Reports
            </h3>
            <Link to="/reports">
              <Button size="sm" variant="ghost">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                <tr>
                  <th className="p-3">Report #</th>
                  <th className="p-3">Patient / Test</th>
                  <th className="p-3">Finalized Date</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.recent_reports || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400">
                      No reports generated yet
                    </td>
                  </tr>
                ) : (
                  (data?.recent_reports || []).map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-teal-700">{r.report_id_display}</td>
                      <td className="p-3">
                        <div className="font-medium text-slate-900">{r.test_name}</div>
                        <div className="text-slate-400 text-[11px]">{r.patient_name}</div>
                      </td>
                      <td className="p-3 text-slate-500">
                        {r.finalized_at
                          ? new Date(r.finalized_at).toLocaleDateString()
                          : new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={r.status === 'FINAL' ? 'normal' : 'pending'}>
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
