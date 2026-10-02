import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trash2, Calculator } from 'lucide-react';
import { Modal, Input, Button, Alert, Badge } from '@/components/ui';
import { patientService } from '@/api/patientService';
import { testService } from '@/api/testService';
import { bookingService } from '@/api/bookingService';
import { Patient, DiagnosticTest, TestPackage } from '@/types';

export interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateBookingModal: React.FC<CreateBookingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Financial Calculations
  const subtotal = selectedItems.reduce((acc, it) => acc + it.price, 0);
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxable * (taxPercentage / 100));
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
      await bookingService.createBooking({
        patient_id: selectedPatientId,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime || undefined,
        referring_doctor: referringDoctor || undefined,
        clinical_notes: clinicalNotes || undefined,
        status: 'CONFIRMED',
        discount_amount: discountAmount,
        tax_percentage: taxPercentage,
        paid_amount: paidAmount,
        items: selectedItems.map((it) => ({
          item_type: it.item_type,
          test_id: it.item_type === 'TEST' ? it.id : undefined,
          package_id: it.item_type === 'PACKAGE' ? it.id : undefined,
        })),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      const respData = err?.response?.data;
      let msg = respData?.message || (typeof respData?.detail === 'string' ? respData.detail : undefined);
      if (respData?.errors && typeof respData.errors === 'object') {
        const errorEntries = Object.entries(respData.errors)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ');
        if (errorEntries) {
          msg = msg ? `${msg} (${errorEntries})` : errorEntries;
        }
      }
      setErrorMessage(msg || err?.message || 'Failed to create booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Diagnostic Order & Booking" maxWidth="xl">
      {errorMessage && (
        <Alert type="error" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
        {/* 1. Patient Selection */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            1. Select Patient *
          </label>
          <div className="grid grid-cols-2 gap-3 mb-2">
            <input
              type="text"
              placeholder="Filter patients by name or phone..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded text-xs bg-white font-medium text-slate-800"
              required
            >
              <option value="">Select Patient...</option>
              {patients.map((p) => (
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
          <div className="flex items-center gap-2 text-brand-400 font-semibold text-xs uppercase tracking-wider">
            <Calculator className="w-4 h-4" />
            Billing & Payment Summary
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
          <Button variant="primary" type="submit" isLoading={isSubmitting}>
            Create Order & Accession Specimens
          </Button>
        </div>
      </form>
    </Modal>
  );
};
