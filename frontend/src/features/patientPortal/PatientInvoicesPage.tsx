import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Input, Badge, Alert } from '@/components/ui';
import { patientPortalService } from '@/api/patientPortalService';
import { InvoiceResponse } from '@/types/invoice';
import { Receipt, Download, Search } from 'lucide-react';

export const PatientInvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await patientPortalService.getInvoices();
      setInvoices(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to fetch billing receipts.');
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const s = search.toLowerCase();
      return (
        search === '' ||
        inv.invoice_id_display.toLowerCase().includes(s) ||
        inv.booking_id_display.toLowerCase().includes(s)
      );
    });
  }, [invoices, search]);

  const handleDownloadReceipt = async (inv: InvoiceResponse) => {
    setDownloadingId(inv.id);
    try {
      await patientPortalService.downloadReceiptPdf(
        inv.id,
        `Receipt_${inv.invoice_id_display}.pdf`
      );
    } catch {
      alert('Payment receipt PDF could not be downloaded.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Receipt className="w-6 h-6 text-purple-600" />
          Invoices & Payment Receipts
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review your laboratory billing statements and download official payment receipts.
        </p>
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
            placeholder="Search by invoice # or booking #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {/* Invoices List */}
      <Card className="overflow-hidden border border-slate-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading billing records...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No invoices or receipts found</p>
            <p className="text-xs text-slate-400 mt-1">
              Your billing statements and payment receipts will appear here after booking tests.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Invoice #</th>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Booking #</th>
                  <th className="p-3.5 text-right">Grand Total</th>
                  <th className="p-3.5 text-right">Paid</th>
                  <th className="p-3.5 text-right">Balance</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-semibold text-purple-700">
                      {inv.invoice_id_display}
                    </td>
                    <td className="p-3.5 text-slate-600 text-xs">{inv.invoice_date}</td>
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
                      <Badge
                        variant={
                          inv.payment_status === 'PAID'
                            ? 'normal'
                            : inv.payment_status === 'PARTIALLY_PAID'
                            ? 'pending'
                            : 'high'
                        }
                      >
                        {inv.payment_status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right">
                      {Number(inv.paid_amount) > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadReceipt(inv)}
                          isLoading={downloadingId === inv.id}
                        >
                          <Download className="w-3.5 h-3.5 mr-1 text-purple-700" />
                          Receipt PDF
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unpaid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
