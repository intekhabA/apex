import React, { useState, useEffect } from 'react';
import { Button, Card, Alert } from '@/components/ui';
import { doctorService } from '@/api/doctorService';
import {
  Doctor,
  DoctorCommissionReport,
} from '@/types/doctor';
import {
  Percent,
  Calendar,
  CalendarDays,
  UserPlus,
  SlidersHorizontal,
  Printer,
  TrendingUp,
  Stethoscope,
  Users,
  TestTubes,
  DollarSign,
  Sparkles,
  Info,
  Clock,
} from 'lucide-react';
import { DoctorCommissionRatesModal } from './DoctorCommissionRatesModal';
import { NewDoctorModal } from './NewDoctorModal';
import { PrintStatementModal } from './PrintStatementModal';

type PeriodType = 'daily' | 'monthly' | 'custom';
type ActiveTab = 'tests' | 'doctors' | 'ledger' | 'trends';

export const DoctorCommissionsPage: React.FC = () => {
  // Filters State
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');

  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);

  // Report Data
  const [report, setReport] = useState<DoctorCommissionReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('tests');

  // Modals
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [rateModalDoctor, setRateModalDoctor] = useState<Doctor | null>(null);
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // 1. Fetch Doctors list on mount
  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const data = await doctorService.getDoctors();
      setDoctorsList(data);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  // 2. Fetch Report whenever filters change
  useEffect(() => {
    fetchReport();
  }, [periodType, selectedDate, selectedMonth, startDate, endDate, selectedDoctorId]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        period: periodType,
      };

      if (periodType === 'daily') {
        params.date = selectedDate;
      } else if (periodType === 'monthly') {
        params.month = selectedMonth;
      } else {
        params.start_date = startDate;
        params.end_date = endDate;
      }

      if (selectedDoctorId) {
        params.doctor_id = selectedDoctorId;
      }

      const res = await doctorService.getCommissionReport(params);
      setReport(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to fetch doctor commissions report.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRatesForDoctor = (doc: Doctor) => {
    setRateModalDoctor(doc);
    setIsRatesModalOpen(true);
  };

  // Quick preset handlers
  const setToday = () => {
    setPeriodType('daily');
    setSelectedDate(todayStr);
  };

  const setYesterday = () => {
    setPeriodType('daily');
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const setThisMonth = () => {
    setPeriodType('monthly');
    setSelectedMonth(currentMonthStr);
  };

  const setLastMonth = () => {
    setPeriodType('monthly');
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    setSelectedMonth(d.toISOString().substring(0, 7));
  };

  const setLast30Days = () => {
    setPeriodType('custom');
    const d = new Date();
    d.setDate(d.getDate() - 30);
    setStartDate(d.toISOString().split('T')[0]);
    setEndDate(todayStr);
  };

  const totalIncome = Number(report?.total_income) || 0;
  const totalCommission = Number(report?.total_commission) || 0;
  const effectivePct = Number(report?.effective_percentage) || 0;
  const totalTests = report?.total_tests || 0;
  const totalPatients = report?.total_patients || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-brand-50 text-brand-700 rounded-xl">
              <Percent className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">
              Doctor Commissions & Referrals
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track referral revenue, analyze test-wise commission percentages, and configure test-specific rates for each doctor.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => setIsPrintModalOpen(true)}
            disabled={!report || report.test_breakdown.length === 0}
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Print Payout Voucher</span>
          </Button>

          <Button
            className="flex items-center gap-2"
            onClick={() => setIsNewDocModalOpen(true)}
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Doctor</span>
          </Button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      {/* Filter Toolbar Card */}
      <Card className="p-4 space-y-4 shadow-sm border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Period Toggle Group */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setPeriodType('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                periodType === 'daily'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Daily
            </button>
            <button
              onClick={() => setPeriodType('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                periodType === 'monthly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Monthly
            </button>
            <button
              onClick={() => setPeriodType('custom')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                periodType === 'custom'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Date Range
            </button>
          </div>

          {/* Dynamic Period Picker Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {periodType === 'daily' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Select Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:ring-brand-500"
                />
                <Button variant="outline" size="sm" onClick={setToday}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={setYesterday}>
                  Yesterday
                </Button>
              </div>
            )}

            {periodType === 'monthly' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Select Month:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:ring-brand-500"
                />
                <Button variant="outline" size="sm" onClick={setThisMonth}>
                  This Month
                </Button>
                <Button variant="outline" size="sm" onClick={setLastMonth}>
                  Last Month
                </Button>
              </div>
            )}

            {periodType === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-600">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:ring-brand-500"
                />
                <span className="text-xs font-semibold text-slate-600">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg shadow-sm focus:ring-1 focus:ring-brand-500"
                />
                <Button variant="outline" size="sm" onClick={setLast30Days}>
                  Last 30 Days
                </Button>
              </div>
            )}

            {/* Doctor Filter Dropdown */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
              <Stethoscope className="w-4 h-4 text-slate-400" />
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white shadow-sm focus:ring-1 focus:ring-brand-500"
              >
                <option value="">All Referring Doctors</option>
                {doctorsList.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.name} {doc.specialization ? `(${doc.specialization})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Selected Period Badge */}
        {report && (
          <div className="text-xs text-slate-500 flex items-center gap-2 pt-2 border-t border-slate-100">
            <span className="font-semibold text-slate-700">Active Scope:</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
              {report.start_date} to {report.end_date}
            </span>
            {report.doctor_filter && (
              <span className="px-2 py-0.5 rounded bg-brand-50 text-brand-700 font-semibold flex items-center gap-1">
                <Stethoscope className="w-3 h-3" /> Doctor: {report.doctor_filter}
              </span>
            )}
          </div>
        )}
      </Card>

      {/* 4 Key Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Referred Income */}
        <Card className="p-5 border-l-4 border-l-brand-600">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Billed Income
            </p>
            <span className="p-2 bg-brand-50 text-brand-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            ₹{totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-semibold text-slate-700">{report?.total_bookings || 0}</span> referred bookings
          </p>
        </Card>

        {/* Total Doctor Commission */}
        <Card className="p-5 border-l-4 border-l-emerald-600 bg-emerald-50/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
              Total Doctor Commission
            </p>
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">
            ₹{totalCommission.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-emerald-700 font-medium mt-1">
            Payout liability for referred tests
          </p>
        </Card>

        {/* Effective Doctor % */}
        <Card className="p-5 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Effective Commission Rate
            </p>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {effectivePct.toFixed(2)}%
          </p>
          <p className="text-xs text-amber-700 font-medium mt-1">
            Weighted avg. of test-specific rates
          </p>
        </Card>

        {/* Patient Tests Referred */}
        <Card className="p-5 border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Patient Tests Referred
            </p>
            <span className="p-2 bg-sky-50 text-sky-600 rounded-lg">
              <TestTubes className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">
            {totalTests}
          </p>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
            Across <span className="font-semibold text-slate-700">{totalPatients}</span> distinct patients
          </p>
        </Card>
      </div>

      {/* Interactive Tabs Header */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('tests')}
            className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'tests'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            Test-Wise Breakdown (Different % per Test)
            {report && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                {report.test_breakdown.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('doctors')}
            className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'doctors'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            Doctors Summary
            {report && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                {report.doctors_summary.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ledger')}
            className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'ledger'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            Patient Referral Ledger
            {report && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700">
                {report.patient_ledger.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={`pb-3 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'trends'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Period Trends
          </button>
        </nav>
      </div>

      {/* Tab 1: Test-Wise Breakdown ("The Hack") */}
      {activeTab === 'tests' && (
        <div className="space-y-4">
          {/* Key Highlight Banner */}
          <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">Test-Specific Commission Model Active:</span> Every test can carry a distinct commission percentage for the same referring doctor (e.g. CBC at 15%, Lipid Profile at 20%, ECG at 25%). Tests with custom overrides are highlighted with the{' '}
              <span className="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-amber-200 text-amber-900 rounded">
                Custom Rate
              </span>{' '}
              badge.
            </div>
          </div>

          <Card className="overflow-hidden border-slate-200">
            {loading ? (
              <div className="p-12 text-center text-sm text-slate-500">
                Calculating test-wise commission breakdown...
              </div>
            ) : report?.test_breakdown.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-500">
                No referral tests recorded for this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-semibold">
                    <tr>
                      <th className="px-5 py-3.5">Test Name & Code</th>
                      <th className="px-4 py-3.5">Category</th>
                      <th className="px-4 py-3.5 text-center">Tests Performed</th>
                      <th className="px-4 py-3.5 text-right">Total Billed Gross</th>
                      <th className="px-4 py-3.5 text-center">Doctor Commission %</th>
                      <th className="px-4 py-3.5 text-right">Earned Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {report?.test_breakdown.map((t, idx) => {
                      const gross = Number(t.total_income) || 0;
                      const comm = Number(t.commission_amount) || 0;
                      const pct = Number(t.commission_percentage) || 0;

                      return (
                        <tr
                          key={idx}
                          className={t.is_custom_percentage ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50'}
                        >
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-slate-900">{t.test_name}</div>
                            {t.test_code && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {t.test_code}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                              {t.category_name || 'General'}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-center font-semibold text-slate-800">
                            {t.tests_count}
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                            ₹{gross.toFixed(2)}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <span className="font-black text-slate-900 text-sm">
                                {pct.toFixed(1)}%
                              </span>
                              {t.is_custom_percentage && (
                                <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                                  Custom
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-emerald-700 text-sm">
                            ₹{comm.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200 text-slate-900">
                    <tr>
                      <td className="px-5 py-3">Total Consolidated</td>
                      <td></td>
                      <td className="px-4 py-3 text-center">{totalTests} tests</td>
                      <td className="px-4 py-3 text-right">₹{totalIncome.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center text-brand-700 font-extrabold">
                        {effectivePct.toFixed(2)}% avg
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-800 font-black text-sm">
                        ₹{totalCommission.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Doctors Summary */}
      {activeTab === 'doctors' && (
        <Card className="overflow-hidden border-slate-200">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading doctor summaries...
            </div>
          ) : report?.doctors_summary.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No doctor referrals found for this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Doctor Name & Details</th>
                    <th className="px-4 py-3.5 text-center">Baseline %</th>
                    <th className="px-4 py-3.5 text-center">Patients</th>
                    <th className="px-4 py-3.5 text-center">Tests Referred</th>
                    <th className="px-4 py-3.5 text-right">Referred Income</th>
                    <th className="px-4 py-3.5 text-right">Commission Earned</th>
                    <th className="px-4 py-3.5 text-center">Effective %</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {report?.doctors_summary.map((d, idx) => {
                    const gross = Number(d.total_income) || 0;
                    const comm = Number(d.total_commission) || 0;
                    const eff = Number(d.effective_percentage) || 0;

                    // Find doctor object
                    const fullDoctorObj = doctorsList.find(
                      (item) => item.id === d.doctor_id || item.name.toLowerCase() === d.doctor_name.toLowerCase()
                    );

                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <Stethoscope className="w-3.5 h-3.5 text-brand-600" />
                            {d.doctor_name}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {d.specialization || 'Physician'} {d.clinic_hospital_name ? `• ${d.clinic_hospital_name}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-slate-700">
                          {Number(d.default_commission_percentage).toFixed(1)}%
                        </td>
                        <td className="px-4 py-3.5 text-center font-medium text-slate-700">
                          {d.total_patients}
                        </td>
                        <td className="px-4 py-3.5 text-center font-semibold text-slate-800">
                          {d.total_tests}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-900">
                          ₹{gross.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-emerald-700 text-sm">
                          ₹{comm.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700">
                            {eff.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex justify-end gap-1.5">
                            {fullDoctorObj && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenRatesForDoctor(fullDoctorObj)}
                                className="flex items-center gap-1 text-[11px]"
                              >
                                <SlidersHorizontal className="w-3 h-3 text-amber-600" />
                                <span>Configure Rates</span>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (d.doctor_id) {
                                  setSelectedDoctorId(d.doctor_id);
                                }
                                setActiveTab('tests');
                              }}
                              className="text-[11px]"
                            >
                              Drilldown
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Patient Referral Ledger */}
      {activeTab === 'ledger' && (
        <Card className="overflow-hidden border-slate-200">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading patient referral ledger...
            </div>
          ) : report?.patient_ledger.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No referral transactions found for this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 font-semibold">
                  <tr>
                    <th className="px-4 py-3.5">Booking & Date</th>
                    <th className="px-4 py-3.5">Patient Details</th>
                    <th className="px-4 py-3.5">Referring Doctor</th>
                    <th className="px-4 py-3.5">Test Performed</th>
                    <th className="px-3 py-3.5 text-right">Test Price</th>
                    <th className="px-3 py-3.5 text-center">Applied %</th>
                    <th className="px-4 py-3.5 text-right">Doctor Commission</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {report?.patient_ledger.map((item, idx) => {
                    const price = Number(item.test_price) || 0;
                    const comm = Number(item.commission_amount) || 0;
                    const pct = Number(item.commission_percentage) || 0;

                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-900 font-mono text-xs">
                            {item.booking_id_display}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {item.booking_date}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-900">{item.patient_name}</div>
                          {item.patient_mrn && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              MRN: {item.patient_mrn}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-800">
                          {item.doctor_name}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900">
                          {item.test_name}
                        </td>
                        <td className="px-3 py-3.5 text-right font-medium text-slate-800">
                          ₹{price.toFixed(2)}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className="px-2 py-0.5 rounded font-bold text-xs bg-slate-100 text-slate-800">
                            {pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-emerald-700">
                          ₹{comm.toFixed(2)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.payment_status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : item.payment_status === 'PARTIAL'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.payment_status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab 4: Period Trends */}
      {activeTab === 'trends' && (
        <Card className="p-6 space-y-6 border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Referral Revenue & Payout Timeline
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical progression of total referred income and doctor commissions over the selected time horizon.
            </p>
          </div>

          {report?.trends.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No trend data available for this range.
            </div>
          ) : (
            <div className="space-y-3">
              {report?.trends.map((t, idx) => {
                const income = Number(t.total_income) || 0;
                const comm = Number(t.total_commission) || 0;
                const maxVal = Math.max(...(report?.trends.map((x) => Number(x.total_income)) || [1]));
                const pctOfMax = maxVal > 0 ? (income / maxVal) * 100 : 0;

                return (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 font-mono">
                        {t.period_label}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-600">
                          Tests: <strong className="text-slate-800">{t.tests_count}</strong>
                        </span>
                        <span className="text-slate-600">
                          Billed: <strong className="text-slate-900">₹{income.toFixed(2)}</strong>
                        </span>
                        <span className="text-emerald-700 font-bold">
                          Commission: ₹{comm.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {/* Visual bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                      <div
                        className="bg-brand-500 h-full rounded-full transition-all"
                        style={{ width: `${pctOfMax}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Modal: Configure Test-Specific Commission Rates */}
      <DoctorCommissionRatesModal
        isOpen={isRatesModalOpen}
        onClose={() => setIsRatesModalOpen(false)}
        doctor={rateModalDoctor}
        onSuccess={() => {
          fetchReport();
          fetchDoctors();
        }}
      />

      {/* Modal: Add Doctor */}
      <NewDoctorModal
        isOpen={isNewDocModalOpen}
        onClose={() => setIsNewDocModalOpen(false)}
        onSuccess={() => {
          fetchDoctors();
          fetchReport();
        }}
      />

      {/* Modal: Print Payout Statement */}
      <PrintStatementModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        report={report}
      />
    </div>
  );
};
