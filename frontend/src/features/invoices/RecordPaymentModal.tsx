import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Alert, Badge } from '@/components/ui';
import { invoiceService } from '@/api/invoiceService';
import { InvoiceResponse, PaymentMethod } from '@/types/invoice';
import { DollarSign, Download, CheckCircle, CreditCard, Receipt } from 'lucide-react';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: InvoiceResponse | null;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  invoice,
}) => {
  const [currentInvoice, setCurrentInvoice] = useState<InvoiceResponse | null>(invoice);
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (invoice) {
      setCurrentInvoice(invoice);
      const bal = Number(invoice.balance_amount) || 0;
      setAmount(bal > 0 ? bal : 0);
      setPaymentMethod('CASH');
      setTransactionReference('');
      setNotes('');
      setError(null);
      setSuccess(null);
    }
  }, [invoice, isOpen]);

  const refreshInvoice = async () => {
    if (!currentInvoice?.id) return;
    try {
      const updated = await invoiceService.getInvoice(currentInvoice.id);
      setCurrentInvoice(updated);
      const bal = Number(updated.balance_amount) || 0;
      setAmount(bal > 0 ? bal : 0);
    } catch {
      // Ignore refresh error
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentInvoice) return;

    if (amount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    const currentBalance = Number(currentInvoice.balance_amount) || 0;
    if (amount > currentBalance) {
      setError(`Payment amount cannot exceed remaining balance of ₹${currentBalance.toFixed(2)}.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await invoiceService.recordPayment(currentInvoice.id, {
        amount: Number(amount),
        payment_method: paymentMethod,
        transaction_reference: transactionReference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setSuccess(`Payment of ₹${amount.toFixed(2)} successfully recorded.`);
      setTransactionReference('');
      setNotes('');
      await refreshInvoice();
      onSuccess();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string; message?: string } } };
      setError(
        errorObj.response?.data?.detail ||
        errorObj.response?.data?.message ||
        'Failed to record payment.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadReceipt = async () => {
    if (!currentInvoice) return;
    setDownloadingReceipt(true);
    try {
      await invoiceService.downloadReceiptPdf(
        currentInvoice.id,
        `Receipt_${currentInvoice.invoice_id_display}.pdf`
      );
    } catch {
      setError('Failed to download receipt PDF.');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  if (!currentInvoice) return null;

  const grandTotal = Number(currentInvoice.grand_total) || 0;
  const paidAmount = Number(currentInvoice.paid_amount) || 0;
  const balanceAmount = Number(currentInvoice.balance_amount) || 0;
  const isFullyPaid = currentInvoice.payment_status === 'PAID' || balanceAmount <= 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Billing Ledger & Payment — ${currentInvoice.invoice_id_display}`}
      maxWidth="xl"
    >
      <div className="space-y-6">
        {error && <Alert type="error" onDismiss={() => setError(null)}>{error}</Alert>}
        {success && <Alert type="success" onDismiss={() => setSuccess(null)}>{success}</Alert>}

        {/* Financial Demographics Overview */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-slate-500 block uppercase font-medium">Patient</span>
            <span className="font-semibold text-slate-900">{currentInvoice.patient_name}</span>
            <span className="text-xs text-slate-400 block">{currentInvoice.patient_id_display}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block uppercase font-medium">Booking ID</span>
            <span className="font-semibold text-slate-800">{currentInvoice.booking_id_display}</span>
            <span className="text-xs text-slate-400 block">{currentInvoice.invoice_date}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block uppercase font-medium">Payment Status</span>
            <Badge
              variant={
                currentInvoice.payment_status === 'PAID'
                  ? 'normal'
                  : currentInvoice.payment_status === 'PARTIALLY_PAID'
                  ? 'pending'
                  : 'high'
              }
            >
              {currentInvoice.payment_status}
            </Badge>
          </div>
          <div>
            <span className="text-xs text-slate-500 block uppercase font-medium">Remaining Balance</span>
            <span
              className={`text-lg font-bold ${
                balanceAmount > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            >
              ₹{balanceAmount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Financial Summary Breakdown */}
        <div className="grid grid-cols-3 gap-3 bg-white p-3 border rounded-lg text-center">
          <div className="border-r border-slate-100 pr-2">
            <span className="text-xs text-slate-500">Grand Total</span>
            <p className="text-base font-bold text-slate-900">₹{grandTotal.toFixed(2)}</p>
          </div>
          <div className="border-r border-slate-100 pr-2">
            <span className="text-xs text-slate-500">Total Received</span>
            <p className="text-base font-bold text-emerald-600">₹{paidAmount.toFixed(2)}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Balance Due</span>
            <p className={`text-base font-bold ${balanceAmount > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
              ₹{balanceAmount.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Record Payment Form (if balance remains) */}
        {!isFullyPaid ? (
          <form onSubmit={handleRecordPayment} className="border border-blue-100 bg-blue-50/40 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-blue-900 font-semibold">
              <DollarSign className="w-5 h-5 text-blue-600" />
              <span>Record New Payment Entry</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Amount (₹) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={balanceAmount}
                  value={amount || ''}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  placeholder="Enter amount"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full h-10 px-3 border border-slate-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CASH">Cash</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="NET_BANKING">Net Banking</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Transaction / Ref No.
                </label>
                <Input
                  type="text"
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  placeholder="e.g. UPI Ref / Card Auth"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Ledger Notes (Optional)
              </label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Remarks regarding this payment transaction"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="submit"
                variant="primary"
                isLoading={submitting}
                disabled={submitting || amount <= 0}
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>Invoice is fully settled. No outstanding balance.</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadReceipt}
              isLoading={downloadingReceipt}
            >
              <Receipt className="w-4 h-4 mr-1 text-emerald-700" />
              Download Receipt
            </Button>
          </div>
        )}

        {/* Payment History Ledger */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-500" />
              Payment Ledger & Receipts ({currentInvoice.payments.length})
            </h4>
            {currentInvoice.payments.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDownloadReceipt}
                isLoading={downloadingReceipt}
              >
                <Download className="w-4 h-4 mr-1" />
                Download PDF Receipt
              </Button>
            )}
          </div>

          {currentInvoice.payments.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-4 text-center border rounded bg-slate-50">
              No payments have been recorded for this invoice yet.
            </p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b">
                  <tr>
                    <th className="p-2.5">Receipt #</th>
                    <th className="p-2.5">Date & Time</th>
                    <th className="p-2.5">Method</th>
                    <th className="p-2.5">Reference</th>
                    <th className="p-2.5">Received By</th>
                    <th className="p-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentInvoice.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-medium text-slate-800">{p.receipt_id_display}</td>
                      <td className="p-2.5 text-slate-600">
                        {new Date(p.created_at).toLocaleString()}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {p.payment_method}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-500">{p.transaction_reference || '—'}</td>
                      <td className="p-2.5 text-slate-600">{p.received_by_name || 'System'}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-600">
                        ₹{Number(p.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
