import React, { useState, useEffect } from 'react';
import { Modal, Button, Alert } from '@/components/ui';
import { doctorService } from '@/api/doctorService';
import { Doctor, DoctorTestCommissionItem } from '@/types/doctor';
import { Search } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  doctor: Doctor | null;
  onSuccess: () => void;
}

export const DoctorCommissionRatesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  doctor,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [tests, setTests] = useState<DoctorTestCommissionItem[]>([]);
  const [search, setSearch] = useState('');
  const [bulkPct, setBulkPct] = useState<string>('');

  useEffect(() => {
    if (isOpen && doctor) {
      loadCommissions();
    }
  }, [isOpen, doctor]);

  const loadCommissions = async () => {
    if (!doctor) return;
    setLoading(true);
    setError(null);
    try {
      const data = await doctorService.getDoctorTestCommissions(doctor.id);
      setTests(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load test commissions.');
    } finally {
      setLoading(false);
    }
  };

  const handlePercentageChange = (testId: string, val: string) => {
    const num = parseFloat(val);
    const validNum = isNaN(num) ? 0 : Math.min(100, Math.max(0, num));
    setTests((prev) =>
      prev.map((t) =>
        t.test_id === testId
          ? { ...t, commission_percentage: validNum, is_custom: true }
          : t
      )
    );
  };

  const applyBulkPercentage = () => {
    const num = parseFloat(bulkPct);
    if (isNaN(num) || num < 0 || num > 100) return;
    setTests((prev) =>
      prev.map((t) => ({
        ...t,
        commission_percentage: num,
        is_custom: true,
      }))
    );
  };

  const resetToDefault = () => {
    if (!doctor) return;
    const def = Number(doctor.default_commission_percentage) || 10;
    setTests((prev) =>
      prev.map((t) => ({
        ...t,
        commission_percentage: def,
        is_custom: false,
      }))
    );
  };

  const handleSave = async () => {
    if (!doctor) return;
    setSaving(true);
    setError(null);
    try {
      const payload = tests.map((t) => ({
        test_id: t.test_id,
        commission_percentage: Number(t.commission_percentage),
      }));
      await doctorService.saveDoctorTestCommissions(doctor.id, payload);
      setSuccessMsg(`Test commission rates saved successfully for ${doctor.name}.`);
      setTimeout(() => {
        setSuccessMsg(null);
        onSuccess();
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save commission rates.');
    } finally {
      setSaving(false);
    }
  };

  const filteredTests = tests.filter((t) => {
    const term = search.toLowerCase();
    return (
      (t.test_name && t.test_name.toLowerCase().includes(term)) ||
      (t.test_code && t.test_code.toLowerCase().includes(term)) ||
      (t.category_name && t.category_name.toLowerCase().includes(term))
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure Test Commission Rates — ${doctor?.name || ''}`}
      description="Customize doctor commission percentages for specific tests. Every test can have its own distinct percentage."
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-slate-500">
            {tests.filter((t) => t.is_custom).length} custom test rate(s) configured
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={saving}>
              Save Rates
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && <Alert type="error">{error}</Alert>}
        {successMsg && <Alert type="success">{successMsg}</Alert>}

        {/* Doctor Baseline Info */}
        <div className="p-3.5 bg-brand-50/60 rounded-xl border border-brand-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
              Doctor Baseline
            </p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {doctor?.name} ({doctor?.specialization || 'Physician'})
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Default Baseline %</p>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-white border border-brand-200 text-brand-700">
              {doctor?.default_commission_percentage}%
            </span>
          </div>
        </div>

        {/* Quick Bulk Tools */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Quick Fill All:</span>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="%"
              value={bulkPct}
              onChange={(e) => setBulkPct(e.target.value)}
              className="w-16 px-2 py-1 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-500"
            />
            <Button variant="outline" size="sm" onClick={applyBulkPercentage}>
              Apply to All
            </Button>
            <Button variant="outline" size="sm" onClick={resetToDefault}>
              Reset to {doctor?.default_commission_percentage}%
            </Button>
          </div>

          <div className="relative w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search tests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Test List Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Loading lab test catalog...
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No matching tests found.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 shadow-sm">
                <tr>
                  <th className="px-4 py-2.5">Test Details</th>
                  <th className="px-3 py-2.5">Category</th>
                  <th className="px-3 py-2.5">Price</th>
                  <th className="px-3 py-2.5 w-32">Doctor Commission %</th>
                  <th className="px-3 py-2.5 text-right">Estimated Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredTests.map((test) => {
                  const price = Number(test.standard_price) || 0;
                  const pct = Number(test.commission_percentage) || 0;
                  const payout = (price * pct) / 100;
                  const isCustom = test.is_custom && pct !== Number(doctor?.default_commission_percentage);

                  return (
                    <tr
                      key={test.test_id}
                      className={isCustom ? 'bg-amber-50/40 hover:bg-amber-50/60' : 'hover:bg-slate-50'}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{test.test_name}</div>
                        {test.test_code && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {test.test_code}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {test.category_name || 'General'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-800">
                        ₹{price.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={test.commission_percentage}
                            onChange={(e) =>
                              handlePercentageChange(test.test_id, e.target.value)
                            }
                            className={`w-16 px-2 py-1 text-xs font-bold rounded border text-right ${
                              isCustom
                                ? 'border-amber-400 bg-amber-50 text-amber-900 focus:ring-amber-500'
                                : 'border-slate-300 text-slate-900 focus:ring-brand-500'
                            }`}
                          />
                          <span className="text-slate-500 font-medium">%</span>
                          {isCustom && (
                            <span
                              title="Custom percentage set for this test"
                              className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1 py-0.5 rounded"
                            >
                              Custom
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-700">
                        ₹{payout.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
};
