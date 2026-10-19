import React, { useState, useEffect, useMemo } from 'react';
import { Button, Card, Badge, Alert, Modal, Input, toast } from '@/components/ui';
import { expenseService } from '@/api/expenseService';
import {
  Expense,
  ExpenseSummary,
  ExpensePeriodType,
  CategoryPresetItem,
} from '@/types';
import {
  Wallet,
  Calendar,
  CalendarDays,
  SlidersHorizontal,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Printer,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Layers,
  CreditCard,
  DollarSign,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { ExpenseModal } from './ExpenseModal';

export const DailyExpensesPage: React.FC = () => {
  // Periods
  const [periodType, setPeriodType] = useState<ExpensePeriodType>('daily');

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const currentMonthStr = useMemo(() => todayStr.substring(0, 7), [todayStr]);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(todayStr);

  // Criteria Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');

  // Data State
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [categoryPresets, setCategoryPresets] = useState<CategoryPresetItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load category presets once
  useEffect(() => {
    expenseService
      .getCategoryPresets()
      .then((data) => setCategoryPresets(data))
      .catch((err) => console.error('Failed to load category presets', err));
  }, []);

  // Fetch summary whenever filters change
  useEffect(() => {
    fetchExpenses();
  }, [
    periodType,
    selectedDate,
    selectedMonth,
    startDate,
    endDate,
    selectedCategory,
    selectedPaymentMethod,
    searchTerm,
  ]);

  const fetchExpenses = async () => {
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

      if (selectedCategory) params.category = selectedCategory;
      if (selectedPaymentMethod) params.payment_method = selectedPaymentMethod;
      if (searchTerm) params.search = searchTerm;

      const data = await expenseService.getExpenseSummary(params);
      setSummary(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to fetch expense records.');
    } finally {
      setLoading(false);
    }
  };

  // Quick navigation handlers for Daily
  const handlePrevDay = () => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() - 1);
    setSelectedDate(cur.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + 1);
    setSelectedDate(cur.toISOString().split('T')[0]);
  };

  const handleSetToday = () => {
    setPeriodType('daily');
    setSelectedDate(todayStr);
  };

  const handleSetYesterday = () => {
    setPeriodType('daily');
    const cur = new Date();
    cur.setDate(cur.getDate() - 1);
    setSelectedDate(cur.toISOString().split('T')[0]);
  };

  // Quick navigation handlers for Monthly
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const yr = prev.getFullYear();
    const mo = String(prev.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${yr}-${mo}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const next = new Date(y, m, 1);
    const yr = next.getFullYear();
    const mo = String(next.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${yr}-${mo}`);
  };

  const handleSetThisMonth = () => {
    setPeriodType('monthly');
    setSelectedMonth(currentMonthStr);
  };

  const handleSetLastMonth = () => {
    setPeriodType('monthly');
    const cur = new Date();
    cur.setMonth(cur.getMonth() - 1);
    const yr = cur.getFullYear();
    const mo = String(cur.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${yr}-${mo}`);
  };

  // Quick presets for Date Range
  const handleSetLast7Days = () => {
    setPeriodType('custom');
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setStartDate(d.toISOString().split('T')[0]);
    setEndDate(todayStr);
  };

  const handleSetLast30Days = () => {
    setPeriodType('custom');
    const d = new Date();
    d.setDate(d.getDate() - 30);
    setStartDate(d.toISOString().split('T')[0]);
    setEndDate(todayStr);
  };

  const handleSetThisYear = () => {
    setPeriodType('custom');
    const yr = new Date().getFullYear();
    setStartDate(`${yr}-01-01`);
    setEndDate(todayStr);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSelectedCategory('');
    setSelectedPaymentMethod('');
    setSearchTerm('');
  };

  // Delete Action
  const handleDeleteConfirm = async () => {
    if (!deleteExpenseId) return;
    setDeleting(true);
    try {
      await expenseService.deleteExpense(deleteExpenseId);
      setDeleteExpenseId(null);
      fetchExpenses();
      toast.success('Expense voucher deleted successfully.');
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to delete expense record.';
      setError(msg);
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // Format Helpers
  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getCategoryBadgeVariant = (catKey: string): any => {
    switch (catKey) {
      case 'LAB_SUPPLIES':
        return 'teal';
      case 'EQUIPMENT':
        return 'brand';
      case 'UTILITIES':
        return 'slate';
      case 'RENT':
        return 'low';
      case 'SALARIES':
        return 'normal';
      case 'REFRESHMENTS':
        return 'pending';
      default:
        return 'slate';
    }
  };

  const getCategoryLabel = (catKey: string) => {
    const found = categoryPresets.find((p) => p.key === catKey);
    return found ? found.label : catKey.replace(/_/g, ' ');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-xl shadow-xs border border-brand-100">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Daily Expenses Management
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Track, filter, and audit laboratory expenditures across daily, monthly, and custom date ranges.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4 text-slate-500" />}
          >
            Print Summary
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setExpenseToEdit(null);
              setIsExpenseModalOpen(true);
            }}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Record Expense
          </Button>
        </div>
      </div>

      {/* Period Filter Card */}
      <Card className="p-4 sm:p-5 shadow-xs border-slate-200 bg-white">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* 1. Period Mode Tabs: Daily / Monthly / Date Range */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 w-fit">
            <button
              type="button"
              onClick={() => setPeriodType('daily')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                periodType === 'daily'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Daily Basis</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('monthly')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                periodType === 'monthly'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              <span>Monthly Basis</span>
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('custom')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                periodType === 'custom'
                  ? 'bg-white text-brand-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Date Range</span>
            </button>
          </div>

          {/* 2. Controls according to selected period */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* DAILY MODE CONTROLS */}
            {periodType === 'daily' && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-xs">
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    title="Previous Day"
                    className="p-2 hover:bg-slate-100 text-slate-600 border-r border-slate-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="py-1.5 px-3 text-sm font-semibold text-slate-800 bg-transparent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleNextDay}
                    title="Next Day"
                    className="p-2 hover:bg-slate-100 text-slate-600 border-l border-slate-200"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <Button
                  variant={selectedDate === todayStr ? 'primary' : 'outline'}
                  size="sm"
                  onClick={handleSetToday}
                >
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={handleSetYesterday}>
                  Yesterday
                </Button>
              </div>
            )}

            {/* MONTHLY MODE CONTROLS */}
            {periodType === 'monthly' && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-xs">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    title="Previous Month"
                    className="p-2 hover:bg-slate-100 text-slate-600 border-r border-slate-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="py-1.5 px-3 text-sm font-semibold text-slate-800 bg-transparent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    title="Next Month"
                    className="p-2 hover:bg-slate-100 text-slate-600 border-l border-slate-200"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <Button
                  variant={selectedMonth === currentMonthStr ? 'primary' : 'outline'}
                  size="sm"
                  onClick={handleSetThisMonth}
                >
                  This Month
                </Button>
                <Button variant="outline" size="sm" onClick={handleSetLastMonth}>
                  Last Month
                </Button>
              </div>
            )}

            {/* DATE RANGE CONTROLS */}
            {periodType === 'custom' && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                  <span className="text-xs font-semibold text-slate-500 uppercase px-1">From:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="py-1 px-2.5 text-xs sm:text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none"
                  />
                  <span className="text-xs font-semibold text-slate-500 uppercase px-1">To:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="py-1 px-2.5 text-xs sm:text-sm font-medium text-slate-800 bg-white border border-slate-300 rounded-md focus:outline-none"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleSetLast7Days}>
                  7 Days
                </Button>
                <Button variant="outline" size="sm" onClick={handleSetLast30Days}>
                  30 Days
                </Button>
                <Button variant="outline" size="sm" onClick={handleSetThisYear}>
                  This Year
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses */}
        <Card className="p-5 border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Expenses
            </span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-rose-600 tracking-tight">
              {formatCurrency(summary?.total_amount)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {periodType === 'daily'
                ? `Total for ${formatDateDisplay(selectedDate)}`
                : periodType === 'monthly'
                ? `Billed in ${selectedMonth}`
                : `Range: ${formatDateDisplay(startDate)} to ${formatDateDisplay(endDate)}`}
            </p>
          </div>
        </Card>

        {/* Total Expense Entries */}
        <Card className="p-5 border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Expense Records
            </span>
            <div className="p-2 bg-brand-50 text-brand-600 rounded-lg">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {summary?.expense_count || 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">Recorded expense vouchers</p>
          </div>
        </Card>

        {/* Average Expense */}
        <Card className="p-5 border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Average Outlay
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900 tracking-tight">
              {formatCurrency(summary?.average_expense)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Per transaction average</p>
          </div>
        </Card>

        {/* Top Category */}
        <Card className="p-5 border-slate-200 bg-white shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Top Spend Category
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-lg font-bold text-slate-900 truncate">
              {summary?.categories_breakdown?.[0]?.category_label || 'None'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {summary?.categories_breakdown?.[0]
                ? `${formatCurrency(summary.categories_breakdown[0].total_amount)} (${summary.categories_breakdown[0].percentage}%)`
                : 'No expenses logged'}
            </p>
          </div>
        </Card>
      </div>

      {/* Analytics & Breakdown Section */}
      {summary && summary.categories_breakdown.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Breakdown Progress Bars */}
          <Card className="lg:col-span-2 p-5 border-slate-200 bg-white shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-600" />
              <span>Category Expenditure Breakdown</span>
            </h3>
            <div className="space-y-3.5">
              {summary.categories_breakdown.map((cat) => (
                <div key={cat.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                      {cat.category_label}
                      <span className="text-slate-400 font-normal">({cat.count} items)</span>
                    </span>
                    <span className="text-slate-900 font-bold">
                      {formatCurrency(cat.total_amount)}{' '}
                      <span className="text-slate-500 font-normal">({cat.percentage}%)</span>
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Payment Method Distribution */}
          <Card className="p-5 border-slate-200 bg-white shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Payment Methods</span>
            </h3>
            <div className="space-y-3">
              {summary.payment_methods_breakdown.map((pm) => (
                <div
                  key={pm.payment_method}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-white rounded-md border border-slate-200 text-slate-600 shadow-2xs">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">{pm.payment_method}</p>
                      <p className="text-2xs text-slate-500">{pm.count} transactions</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    {formatCurrency(pm.total_amount)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Criteria Filter Bar */}
      <Card className="p-4 border-slate-200 bg-white shadow-xs print:hidden">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1 flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="w-full sm:w-72">
              <Input
                placeholder="Search description, vendor, receipt..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              />
            </div>

            {/* Category Dropdown Filter */}
            <div className="w-full sm:w-56">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-slate-400 transition-colors"
              >
                <option value="">All Categories</option>
                {categoryPresets.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Dropdown Filter */}
            <div className="w-full sm:w-44">
              <select
                value={selectedPaymentMethod}
                onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 px-3.5 text-xs sm:text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-slate-400 transition-colors"
              >
                <option value="">All Payment Modes</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI / QR</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          {(selectedCategory || selectedPaymentMethod || searchTerm) && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Error display */}
      {error && (
        <Alert type="error" title="Error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Expenses Table */}
      <Card className="border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Expenses Ledger
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
              {summary?.expenses?.length || 0} Records
            </span>
          </div>

          <span className="text-xs font-medium text-slate-400">
            {periodType === 'daily'
              ? formatDateDisplay(selectedDate)
              : periodType === 'monthly'
              ? selectedMonth
              : `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
            <p className="text-sm font-semibold">Loading daily expense records...</p>
          </div>
        ) : !summary || summary.expenses.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <div className="p-4 bg-slate-50 rounded-full text-slate-400 border border-slate-100">
              <Receipt className="w-8 h-8" />
            </div>
            <p className="text-base font-bold text-slate-700">No expenses recorded for this period</p>
            <p className="text-xs text-slate-400 max-w-sm">
              No expenditure entries were found for the selected {periodType} date window or filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setExpenseToEdit(null);
                setIsExpenseModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
              className="mt-2"
            >
              Record First Expense
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Expense Item</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Vendor / Payee</th>
                  <th className="px-4 py-3">Payment Mode</th>
                  <th className="px-4 py-3">Receipt #</th>
                  <th className="px-4 py-3 text-right">Amount (₹)</th>
                  <th className="px-4 py-3 text-center print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {summary.expenses.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Date */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs font-semibold text-slate-600">
                      {formatDateDisplay(item.expense_date)}
                    </td>

                    {/* Title & Notes */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{item.title}</div>
                      {item.notes && (
                        <p className="text-xs text-slate-400 mt-0.5 max-w-md line-clamp-1">
                          {item.notes}
                        </p>
                      )}
                      {item.created_by_name && (
                        <p className="text-2xs text-slate-400 mt-0.5">
                          By: {item.created_by_name}
                        </p>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Badge variant={getCategoryBadgeVariant(item.category)}>
                        {getCategoryLabel(item.category)}
                      </Badge>
                    </td>

                    {/* Vendor */}
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {item.vendor_name || '—'}
                    </td>

                    {/* Payment Mode */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs">
                      <span className="font-semibold text-slate-700">
                        {item.payment_method || 'CASH'}
                      </span>
                    </td>

                    {/* Receipt Number */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-xs text-slate-500 font-mono">
                      {item.receipt_number || '—'}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-right font-black text-rose-600">
                      {formatCurrency(item.amount)}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-center print:hidden">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setExpenseToEdit(item);
                            setIsExpenseModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Edit Expense"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteExpenseId(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right text-xs uppercase tracking-wider text-slate-500">
                    Total Period Outlay:
                  </td>
                  <td className="px-4 py-3 text-right font-black text-rose-600 text-base">
                    {formatCurrency(summary.total_amount)}
                  </td>
                  <td className="print:hidden"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Expense Modal */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setExpenseToEdit(null);
        }}
        onSuccess={() => {
          fetchExpenses();
        }}
        expenseToEdit={expenseToEdit}
        categoryPresets={categoryPresets}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteExpenseId)}
        onClose={() => setDeleteExpenseId(null)}
        title="Confirm Expense Deletion"
        description="Are you sure you want to delete this expense record? This action cannot be undone."
        maxWidth="md"
        footer={
          <div className="flex justify-end gap-3 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteExpenseId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteConfirm}
              isLoading={deleting}
            >
              Delete Expense
            </Button>
          </div>
        }
      >
        <div className="flex items-center gap-3 p-3 bg-rose-50 text-rose-800 rounded-lg border border-rose-200/60">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <p className="text-xs">
            Deleting this expense will permanently remove it from the ledger and adjust all financial metrics for this period.
          </p>
        </div>
      </Modal>
    </div>
  );
};
