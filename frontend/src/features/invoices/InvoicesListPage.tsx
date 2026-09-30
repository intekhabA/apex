import React, { useState, useEffect, useMemo } from 'react';
import { Button, Input, Badge, Alert, Card } from '@/components/ui';
import { invoiceService } from '@/api/invoiceService';
import { InvoiceResponse, InvoicePaymentStatus } from '@/types/invoice';
import {
  CreditCard,
  Download,
  Receipt,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { RecordPaymentModal } from './RecordPaymentModal';

export const InvoicesListPage: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvoicePaymentStatus>('ALL');

  // Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceResponse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await invoiceService.getInvoices();
      setInvoices(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to fetch billing invoices.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const s = search.toLowerCase();
      const matchesSearch =
        search === '' ||
        inv.invoice_id_display.toLowerCase().includes(s) ||
        inv.patient_name.toLowerCase().includes(s) ||
        inv.patient_id_display.toLowerCase().includes(s) ||
        inv.booking_id_display.toLowerCase().includes(s);

      const matchesStatus = statusFilter === 'ALL' || inv.payment_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalBilled = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;
    let paidCount = 0;

    for (const inv of invoices) {
      totalBilled += Number(inv.grand_total) || 0;
      totalCollected += Number(inv.paid_amount) || 0;
      totalOutstanding += Number(inv.balance_amount) || 0;
      if (inv.payment_status === 'PAID') paidCount++;
    }

    return { totalBilled, totalCollected, totalOutstanding, paidCount };
  }, [invoices]);

  const handleOpenLedger = (inv: InvoiceResponse) => {
    setSelectedInvoice(inv);
    setIsModalOpen(true);
  };

  const handleDownloadReceipt = async (inv: InvoiceResponse, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingId(inv.id);
    try {
      await invoiceService.downloadReceiptPdf(
        inv.id,
        `Receipt_${inv.invoice_id_display}.pdf`
      );
    } catch {
      alert('Receipt PDF is not available yet.');
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: InvoicePaymentStatus) => {
    switch (status) {
      case 'PAID':
        return <Badge variant="normal">Paid</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge variant="pending">Partially Paid</Badge>;
      case 'UNPAID':
        return <Badge variant="high">Unpaid</Badge>;
      case 'REFUNDED':
        return <Badge variant="slate">Refunded</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-blue-600" />
            Billing & Invoices Ledger
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track lab invoices, manage payment transactions, and issue tamper-proof receipts.
          </p>
        </div>
      </div>

      {errorMessage && (
        <Alert type="error" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Billed
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                ₹{metrics.totalBilled.toFixed(2)}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Collected
              </p>
              <h3 className="text-xl font-bold text-emerald-600 mt-1">
                ₹{metrics.totalCollected.toFixed(2)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Outstanding Balance
              </p>
              <h3 className="text-xl font-bold text-amber-600 mt-1">
                ₹{metrics.totalOutstanding.toFixed(2)}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Settled Invoices
              </p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">
                {metrics.paidCount} / {invoices.length}
              </h3>
            </div>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters Toolbar */}
      <Card className="p-4 bg-white border border-slate-200">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by invoice #, patient, patient ID, booking #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | InvoicePaymentStatus)}
              className="h-10 px-3 border border-slate-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Invoices Table */}
      <Card className="overflow-hidden border border-slate-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading billing invoices...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No invoices matching the selected criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Patient Details</th>
                  <th className="p-3.5">Booking #</th>
                  <th className="p-3.5 text-right">Grand Total</th>
                  <th className="p-3.5 text-right">Paid</th>
                  <th className="p-3.5 text-right">Balance</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => handleOpenLedger(inv)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="p-3.5 font-semibold text-blue-600">
                      {inv.invoice_id_display}
                    </td>
                    <td className="p-3.5 text-slate-600 text-xs">
                      {inv.invoice_date}
                    </td>
                    <td className="p-3.5">
                      <div className="font-medium text-slate-900">{inv.patient_name}</div>
                      <div className="text-xs text-slate-400">{inv.patient_id_display}</div>
                    </td>
                    <td className="p-3.5 text-slate-700 text-xs font-mono">
                      {inv.booking_id_display}
                    </td>
                    <td className="p-3.5 text-right font-medium text-slate-900">
                      ₹{Number(inv.grand_total).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-medium text-emerald-600">
                      ₹{Number(inv.paid_amount).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-right font-bold text-amber-600">
                      ₹{Number(inv.balance_amount).toFixed(2)}
                    </td>
                    <td className="p-3.5 text-center">
                      {getStatusBadge(inv.payment_status)}
                    </td>
                    <td className="p-3.5 text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenLedger(inv);
                        }}
                      >
                        <CreditCard className="w-3.5 h-3.5 mr-1" />
                        Ledger
                      </Button>
                      {Number(inv.paid_amount) > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => handleDownloadReceipt(inv, e)}
                          isLoading={downloadingId === inv.id}
                          title="Download Receipt PDF"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-600" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Record Payment / Ledger Modal */}
      <RecordPaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchInvoices();
        }}
        invoice={selectedInvoice}
      />
    </div>
  );
};
