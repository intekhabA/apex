import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Alert, toast } from '@/components/ui';
import { expenseService } from '@/api/expenseService';
import { Expense, CategoryPresetItem } from '@/types';
import { Calendar, User, FileText } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expenseToEdit?: Expense | null;
  categoryPresets: CategoryPresetItem[];
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  expenseToEdit,
  categoryPresets,
}) => {
  const isEditing = Boolean(expenseToEdit);
  const todayStr = new Date().toISOString().split('T')[0];

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('LAB_SUPPLIES');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [vendorName, setVendorName] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expenseToEdit) {
      setTitle(expenseToEdit.title);
      const isPreset = categoryPresets.some((p) => p.key === expenseToEdit.category);
      if (isPreset) {
        setCategory(expenseToEdit.category);
        setIsCustomCategory(false);
        setCustomCategory('');
      } else {
        setCategory('CUSTOM');
        setIsCustomCategory(true);
        setCustomCategory(expenseToEdit.category);
      }
      setAmount(String(expenseToEdit.amount));
      setExpenseDate(expenseToEdit.expense_date);
      setPaymentMethod(expenseToEdit.payment_method || 'CASH');
      setVendorName(expenseToEdit.vendor_name || '');
      setReceiptNumber(expenseToEdit.receipt_number || '');
      setNotes(expenseToEdit.notes || '');
    } else {
      setTitle('');
      setCategory('LAB_SUPPLIES');
      setIsCustomCategory(false);
      setCustomCategory('');
      setAmount('');
      setExpenseDate(todayStr);
      setPaymentMethod('CASH');
      setVendorName('');
      setReceiptNumber('');
      setNotes('');
    }
    setError(null);
  }, [expenseToEdit, isOpen, categoryPresets, todayStr]);

  const handleCategorySelect = (val: string) => {
    if (val === 'CUSTOM') {
      setIsCustomCategory(true);
      setCategory('CUSTOM');
    } else {
      setIsCustomCategory(false);
      setCategory(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Expense title or item description is required.');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid expense amount greater than zero.');
      return;
    }

    if (!expenseDate) {
      setError('Please select an expense date.');
      return;
    }

    const finalCategory = isCustomCategory
      ? customCategory.trim() || 'OTHER'
      : category;

    setLoading(true);
    try {
      if (isEditing && expenseToEdit) {
        await expenseService.updateExpense(expenseToEdit.id, {
          title: title.trim(),
          category: finalCategory,
          amount: numericAmount,
          expense_date: expenseDate,
          payment_method: paymentMethod,
          vendor_name: vendorName.trim() || undefined,
          receipt_number: receiptNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      } else {
        await expenseService.createExpense({
          title: title.trim(),
          category: finalCategory,
          amount: numericAmount,
          expense_date: expenseDate,
          payment_method: paymentMethod,
          vendor_name: vendorName.trim() || undefined,
          receipt_number: receiptNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        });
      }
      toast.success(
        isEditing
          ? 'Expense voucher updated successfully.'
          : 'Expense voucher recorded successfully.'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save expense.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Expense Record' : 'Record New Expense'}
      description="Track daily operational laboratory outlays, purchases, and petty cash."
      maxWidth="lg"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={loading}>
            {isEditing ? 'Save Changes' : 'Record Expense'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert type="error" title="Error" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Expense Title */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Expense Title / Item Description <span className="text-rose-500">*</span>
          </label>
          <Input
            placeholder="e.g. Syringes & vacutainer needles, Electricity bill, Tea & biscuits"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        {/* Amount & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              leftIcon={<span className="font-bold text-slate-400">₹</span>}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Expense Date <span className="text-rose-500">*</span>
            </label>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              leftIcon={<Calendar className="w-4 h-4" />}
              required
            />
          </div>
        </div>

        {/* Category & Payment Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Expense Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => handleCategorySelect(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2.5 px-3.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-slate-400 transition-colors"
            >
              {categoryPresets.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
              <option value="CUSTOM">+ Custom Category...</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Payment Method <span className="text-rose-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2.5 px-3.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-slate-400 transition-colors"
            >
              <option value="CASH">Cash (Petty Cash)</option>
              <option value="UPI">UPI / QR Code</option>
              <option value="CARD">Debit / Credit Card</option>
              <option value="BANK_TRANSFER">Bank Transfer / NEFT / IMPS</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other Payment</option>
            </select>
          </div>
        </div>

        {/* Custom Category Input if selected */}
        {isCustomCategory && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Specify Custom Category <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. Software License, Accreditation Fee"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              required
            />
          </div>
        )}

        {/* Vendor & Receipt / Invoice # */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Paid To / Vendor Name
            </label>
            <Input
              placeholder="e.g. Accurex Diagnostics, Local Stationery"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Receipt / Bill / Voucher #
            </label>
            <Input
              placeholder="e.g. BILL-9921, PETTY-04"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              leftIcon={<FileText className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Notes / Remarks
          </label>
          <textarea
            rows={2}
            className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-slate-400 transition-colors placeholder:text-slate-400"
            placeholder="Additional details, approved by, or item breakdown..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
};
