import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Badge, Alert, Button } from '@/components/ui';
import { dashboardService } from '@/api/dashboardService';
import { SuperAdminDashboardData } from '@/types/dashboard';
import {
  Building2,
  Users,
  DollarSign,
  TestTubes,
  CalendarDays,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';

export const SuperAdminDashboardView: React.FC = () => {
  const [data, setData] = useState<SuperAdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await dashboardService.getSuperAdminDashboard();
      setData(res);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to load platform analytics.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Loading platform analytics...</div>;
  }

  const COLORS = ['#0284c7', '#0d9488', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981'];

  return (
    <div className="space-y-6">
      {errorMessage && (
        <Alert type="error" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/20 text-blue-200 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
            Global Platform Governance Overview
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Super Administrator Dashboard
          </h1>
          <p className="mt-1.5 text-slate-300 text-sm max-w-xl">
            Real-time multi-tenant telemetry, platform financial throughput, and laboratory network growth metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/admin/laboratories">
            <Button variant="secondary" size="md">
              <Building2 className="w-4 h-4 mr-2" />
              Manage Laboratories
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Laboratories
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {data?.total_laboratories || 0}
              </h3>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">
                {data?.active_laboratories || 0} Active Tenants
              </p>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Platform Revenue
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                ₹{Number(data?.total_revenue || 0).toFixed(2)}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Aggregated Collections</p>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Platform Bookings
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {data?.total_bookings || 0}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {data?.total_reports_completed || 0} Reports Finalized
              </p>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <CalendarDays className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Patients & Catalog
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {data?.total_patients || 0}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {data?.total_tests || 0} Standard Tests
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform 7-Day Revenue Trend */}
        <Card className="p-5 bg-white border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                7-Day Platform Collections Trend
              </h3>
              <p className="text-xs text-slate-500">Daily gross payment collections across all tenant labs</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.daily_trends || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  formatter={(val: unknown) => [`₹${Number(val).toFixed(2)}`, 'Revenue']}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Tests by Category Distribution */}
        <Card className="p-5 bg-white border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <TestTubes className="w-4 h-4 text-blue-600" />
                Diagnostic Catalog by Specialty
              </h3>
              <p className="text-xs text-slate-500">Available test definitions across clinical departments</p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.category_distribution || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="category_name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="test_count" name="Tests" fill="#0284c7" radius={[4, 4, 0, 0]}>
                  {(data?.category_distribution || []).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tenant Laboratories Operational Performance */}
      <Card className="overflow-hidden border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              Tenant Laboratory Network Performance
            </h3>
            <p className="text-xs text-slate-500">Live operational volume and throughput per laboratory tenant</p>
          </div>
          <Link to="/admin/laboratories">
            <Button size="sm" variant="ghost">
              All Laboratories <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Lab Code</th>
                <th className="p-3.5">Laboratory Name</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Total Bookings</th>
                <th className="p-3.5 text-right">Gross Collections</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.lab_performance || []).map((l) => (
                <tr key={l.lab_id} className="hover:bg-slate-50">
                  <td className="p-3.5 font-mono font-semibold text-blue-700">{l.lab_code}</td>
                  <td className="p-3.5 font-medium text-slate-900">{l.lab_name}</td>
                  <td className="p-3.5 text-center">
                    <Badge variant={l.is_active ? 'normal' : 'high'}>
                      {l.is_active ? 'Active' : 'Suspended'}
                    </Badge>
                  </td>
                  <td className="p-3.5 text-right font-medium text-slate-900">{l.total_bookings}</td>
                  <td className="p-3.5 text-right font-bold text-emerald-600">
                    ₹{Number(l.total_revenue).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
