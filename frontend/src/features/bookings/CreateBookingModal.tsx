import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Trash2,
  Calculator,
  Printer,
  Download,
  CheckCircle2,
  UserPlus,
  Receipt,
} from 'lucide-react';
import { Modal, Input, Button, Alert, Badge, toast } from '@/components/ui';
import { patientService } from '@/api/patientService';
import { testService } from '@/api/testService';
import { bookingService } from '@/api/bookingService';
import { invoiceService } from '@/api/invoiceService';
import { AddPatientModal } from '@/features/patients/AddPatientModal';
import { useAuth } from '@/hooks/useAuth';
import { printReceiptFromBooking } from '@/utils/receiptPrinter';
import { Patient, DiagnosticTest, TestPackage, Booking } from '@/types';

export interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPatient?: Patient | null;
  initialPatientId?: string;
}

export const CreateBookingModal: React.FC<CreateBookingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPatient,
  initialPatientId,
}) => {
  const { user } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [createdBookingResult, setCreatedBookingResult] = useState<Booking | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Form State
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [appointmentTime, setAppointmentTime] = useState('09:00 AM');
  const [referringDoctor, setReferringDoctor] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Selected items: array of { item_type, id, name, price }
  const [selectedItems, setSelectedItems] = useState<
    { item_type: 'TEST' | 'PACKAGE'; id: string; name: string; price: number }[]
  >([]);

  // Financial fields
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxPercentage, setTaxPercentage] = useState<number>(5);
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<
    'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'
  >('CASH');

  // Pre-fill initial patient when opened
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setCreatedBookingResult(null);
      if (initialPatient) {
        setSelectedPatientId(initialPatient.id);
        if (initialPatient.referring_doctor) {
          setReferringDoctor(initialPatient.referring_doctor);
        }
      } else if (initialPatientId) {
        setSelectedPatientId(initialPatientId);
      }
    } else {
      // Reset selections on modal close
      setSelectedItems([]);
      setDiscountAmount(0);
      setPaidAmount(0);
      setClinicalNotes('');
      setErrorMessage(null);
      setCreatedBookingResult(null);
    }
  }, [isOpen, initialPatient, initialPatientId]);

  // Queries
  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ['patients-search', patientSearch],
    queryFn: () => patientService.getPatients(patientSearch || undefined),
    enabled: isOpen,
  });

  const { data: tests = [] } = useQuery<DiagnosticTest[]>({
    queryKey: ['tests-active'],
    queryFn: () => testService.getTests(),
    enabled: isOpen,
  });

  const { data: packages = [] } = useQuery<TestPackage[]>({
    queryKey: ['packages-active'],
    queryFn: () => testService.getPackages(),
    enabled: isOpen,
  });

  // Ensure initialPatient or freshly registered patient is in the dropdown options
  const availablePatients = useMemo(() => {
    const list = [...patients];
    if (initialPatient && !list.some((p) => p.id === initialPatient.id)) {
      list.unshift(initialPatient);
    }
    return list;
  }, [patients, initialPatient]);

  // Current selected patient object for quick display
  const activePatient = useMemo(() => {
    return availablePatients.find((p) => p.id === selectedPatientId) || null;
  }, [availablePatients, selectedPatientId]);

  // Financial Calculations
  const subtotal = selectedItems.reduce((acc, it) => acc + it.price, 0);
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = taxable * (taxPercentage / 100);
  const grandTotal = taxable + taxAmount;
  const balance = Math.max(0, grandTotal - paidAmount);

  const handleAddTest = (testId: string) => {
    const t = tests.find((x) => x.id === testId);
    if (!t) return;
    if (selectedItems.some((it) => it.id === testId)) return;
    setSelectedItems((prev) => [
      ...prev,
      {
        item_type: 'TEST',
        id: t.id,
        name: t.name,
        price: Number(t.effective_price ?? t.default_price),
      },
    ]);
  };

  const handleAddPackage = (pkgId: string) => {
    const pkg = packages.find((x) => x.id === pkgId);
    if (!pkg) return;
    if (selectedItems.some((it) => it.id === pkgId)) return;
    setSelectedItems((prev) => [
      ...prev,
      {
        item_type: 'PACKAGE',
        id: pkg.id,
        name: pkg.name,
        price: Number(pkg.price),
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePrintReceiptNow = (bookingObj: Booking) => {
    setIsPrinting(true);
    try {
      printReceiptFromBooking(bookingObj, activePatient, paymentMethod, user?.lab_name);
    } catch (err) {
      console.error('Failed to trigger receipt print:', err);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setErrorMessage('Please select a registered patient.');
      return;
    }
    if (selectedItems.length === 0) {
      setErrorMessage('Please add at least one test or package.');
      return;
    }
    if (!appointmentDate) {
      setErrorMessage('Please select an appointment date.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const created = await bookingService.createBooking({
        patient_id: selectedPatientId,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime || undefined,
        referring_doctor: referringDoctor || undefined,
        clinical_notes: clinicalNotes || undefined,
        status: 'CONFIRMED',
        discount_amount: discountAmount,
        tax_percentage: taxPercentage,
        paid_amount: paidAmount,
        payment_method: paymentMethod,
        items: selectedItems.map((it) => ({
          item_type: it.item_type,
          test_id: it.item_type === 'TEST' ? it.id : undefined,
          package_id: it.item_type === 'PACKAGE' ? it.id : undefined,
        })),
      });

      // Automatically trigger instant printing of ONLY the receipt
      handlePrintReceiptNow(created);

      setCreatedBookingResult(created);
      toast.success(
        `Diagnostic order ${created.booking_id_display || ''} booked successfully!`
      );
    } catch (err: any) {
      const respData = err?.response?.data;
      let msg =
        respData?.message ||
        (typeof respData?.detail === 'string' ? respData.detail : undefined);
      if (respData?.errors && typeof respData.errors === 'object') {
        const errorEntries = Object.entries(respData.errors)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
        if (errorEntries) {
          msg = msg ? `${msg} (${errorEntries})` : errorEntries;
        }
      }
      const finalMsg = msg || err?.message || 'Failed to create booking.';
      setErrorMessage(finalMsg);
      toast.error(finalMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinishAndClose = () => {
    setCreatedBookingResult(null);
    onSuccess();
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => {
          if (createdBookingResult) {
            handleFinishAndClose();
          } else {
            onClose();
          }
        }}
        title="Diagnostic Order & Billing"
        maxWidth="xl"
      >
        {errorMessage && (
          <Alert type="error" className="mb-4">
            {errorMessage}
          </Alert>
        )}

        {/* View 1: Instant Receipt Print Confirmation on Save */}
        {createdBookingResult ? (
          <div className="py-4 px-2 space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Order Created & Billing Receipt Ready!
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Diagnostic Order{' '}
                <span className="font-mono font-bold text-slate-800">
                  {createdBookingResult.booking_id_display}
                </span>{' '}
                and Invoice{' '}
                <span className="font-mono font-bold text-slate-800">
                  {createdBookingResult.invoice_id_display || 'INV'}
                </span>{' '}
                have been recorded.
              </p>
            </div>

            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold max-w-md mx-auto flex items-center justify-center gap-2">
              <Printer className="w-4 h-4 text-emerald-600 animate-pulse" />
              Receipt print dialog launched for printing receipt only.
            </div>

            {/* Visual Receipt Slip Card Preview */}
            <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-xl p-4 shadow-sm text-xs space-y-2">
              <div className="flex justify-between items-start border-b pb-2">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    {user?.lab_name || 'DiagnoLab Diagnostics'}
                  </h4>
                  <p className="text-slate-500 text-[11px]">Payment Receipt / Voucher</p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-brand-700">
                    #{createdBookingResult.invoice_id_display || createdBookingResult.booking_id_display}
                  </span>
                  <p className="text-[10px] text-slate-400">{new Date().toLocaleDateString()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] py-1 border-b border-slate-100">
                <div>
                  <span className="text-slate-400">Patient: </span>
                  <span className="font-semibold text-slate-700">
                    {createdBookingResult.patient_name || activePatient?.full_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Phone: </span>
                  <span className="font-mono text-slate-700">
                    {createdBookingResult.patient_phone || activePatient?.phone || '—'}
                  </span>
                </div>
              </div>

              <div className="space-y-1 py-1 max-h-32 overflow-y-auto">
                {createdBookingResult.items?.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-slate-600 text-[11px]">
                    <span className="truncate max-w-[240px]">{it.item_name}</span>
                    <span className="font-mono">₹{Number(it.final_price).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-2 space-y-0.5 text-[11px]">
                <div className="flex justify-between text-slate-500">
                  <span>Grand Total:</span>
                  <span className="font-mono font-bold text-slate-800">
                    ₹{Number(createdBookingResult.grand_total).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Paid ({paymentMethod}):</span>
                  <span className="font-mono">
                    ₹{Number(createdBookingResult.paid_amount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Balance Due:</span>
                  <span className="font-mono">
                    ₹{Number(createdBookingResult.balance_amount).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-3 border-t border-slate-100">
              <Button
                variant="primary"
                onClick={() => handlePrintReceiptNow(createdBookingResult)}
                isLoading={isPrinting}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Print Receipt Again
              </Button>
              {createdBookingResult.invoice_id && (
                <Button
                  variant="outline"
                  onClick={() =>
                    invoiceService.downloadReceiptPdf(
                      createdBookingResult.invoice_id!,
                      `Receipt_${createdBookingResult.invoice_id_display || createdBookingResult.booking_id_display}.pdf`
                    )
                  }
                  className="flex items-center gap-1.5 border-brand-300 text-brand-700 hover:bg-brand-50"
                >
                  <Download className="w-4 h-4" />
                  Download Receipt (PDF)
                </Button>
              )}
              <Button variant="secondary" onClick={handleFinishAndClose}>
                Done & Close
              </Button>
            </div>
          </div>
        ) : (
          /* View 2: Diagnostic Booking & Billing Form */
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
            {/* 1. Patient Selection Header */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Patient Details *
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddPatientOpen(true)}
                  className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  + Register New Patient
                </button>
              </div>

              {activePatient && (
                <div className="mb-2.5 p-2.5 bg-brand-50/60 border border-brand-200 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-brand-900 text-sm">
                      {activePatient.full_name}
                    </span>
                    <span className="text-brand-700 ml-2 font-mono">
                      ({activePatient.patient_id_display})
                    </span>
                    <span className="text-slate-600 ml-2">
                      {activePatient.gender} • {activePatient.age_years}y
                    </span>
                  </div>
                  <div className="font-mono text-slate-700 font-medium">
                    {activePatient.phone}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-1">
                <input
                  type="text"
                  placeholder="Search existing patient by name or phone..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <select
                  value={selectedPatientId}
                  onChange={(e) => {
                    setSelectedPatientId(e.target.value);
                    const chosen = availablePatients.find((p) => p.id === e.target.value);
                    if (chosen?.referring_doctor) {
                      setReferringDoctor(chosen.referring_doctor);
                    }
                  }}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs bg-white font-medium text-slate-800"
                  required
                >
                  <option value="">Select Patient...</option>
                  {availablePatients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.patient_id_display}) - {p.phone}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Test & Package Selection */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                2. Add Tests & Packages *
              </label>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <span className="text-[11px] text-slate-500 mb-1 block">Add Diagnostic Test:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddTest(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  >
                    <option value="">Choose test to add...</option>
                    {tests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code}) - ₹{Number(t.effective_price ?? t.default_price).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 mb-1 block">Add Health Package:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddPackage(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded text-xs bg-white"
                  >
                    <option value="">Choose bundle to add...</option>
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} ({pkg.code}) - ₹{Number(pkg.price).toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selected Items List */}
              {selectedItems.length > 0 && (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded bg-white">
                  {selectedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={item.item_type === 'PACKAGE' ? 'brand' : 'slate'}>
                          {item.item_type}
                        </Badge>
                        <span className="font-semibold text-slate-800">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-slate-900">
                          ₹{item.price.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Appointment & Logistics */}
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Appointment Date *"
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                required
              />
              <Input
                label="Time Slot"
                placeholder="09:30 AM"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
              />
              <Input
                label="Referring Doctor"
                placeholder="e.g. Dr. K. Sharma"
                value={referringDoctor}
                onChange={(e) => setReferringDoctor(e.target.value)}
              />
            </div>

            <div>
              <Input
                label="Clinical Notes / Symptoms"
                placeholder="e.g. Fasting sample requested, fever since 3 days"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
              />
            </div>

            {/* 4. Financial Calculations Panel */}
            <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-brand-400 font-semibold text-xs uppercase tracking-wider">
                  <Calculator className="w-4 h-4" />
                  Billing & Payment Summary
                </div>
                {paidAmount > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Mode:</span>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="bg-slate-800 border border-slate-700 text-white rounded px-2 py-0.5 text-xs font-semibold focus:outline-none"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI / QR</option>
                      <option value="CARD">Card</option>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Tax (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={taxPercentage}
                    onChange={(e) => setTaxPercentage(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Paid Amount (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400">Subtotal: </span>
                  <span className="font-mono text-slate-200">₹{subtotal.toFixed(2)}</span>
                  <span className="text-slate-500 mx-2">|</span>
                  <span className="text-slate-400">Tax: </span>
                  <span className="font-mono text-slate-200">₹{taxAmount.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <div>
                    <span className="text-slate-400">Grand Total: </span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Balance Due: </span>
                    <span className="font-bold font-mono text-rose-400">
                      ₹{balance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                isLoading={isSubmitting}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Receipt className="w-4 h-4" />
                Save Order & Print Receipt Instantly
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Nested Add Patient Modal for quick-registering patient right inside billing modal */}
      <AddPatientModal
        isOpen={isAddPatientOpen}
        onClose={() => setIsAddPatientOpen(false)}
        onSuccess={(createdPatient) => {
          if (createdPatient) {
            setSelectedPatientId(createdPatient.id);
            if (createdPatient.referring_doctor) {
              setReferringDoctor(createdPatient.referring_doctor);
            }
          }
        }}
      />
    </>
  );
};
