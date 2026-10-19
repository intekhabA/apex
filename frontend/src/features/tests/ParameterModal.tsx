import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Alert, toast } from '@/components/ui';
import { testService } from '@/api/testService';
import { TestParameter, ResultValueType } from '@/types';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  testId: string;
  testName?: string;
  parameter: TestParameter | null;
}

interface ReferenceRangeFormItem {
  id?: string;
  gender: 'MALE' | 'FEMALE' | '' | null;
  age_min_years: number;
  age_max_years: number;
  min_value?: string;
  max_value?: string;
  critical_low?: string;
  critical_high?: string;
  text_normal_value?: string;
  display_range_string: string;
}

export const ParameterModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  testId,
  testName,
  parameter,
}) => {
  const isEdit = Boolean(parameter);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [unit, setUnit] = useState('');
  const [resultType, setResultType] = useState<ResultValueType>('NUMBER');
  const [decimalPrecision, setDecimalPrecision] = useState(2);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [referenceRanges, setReferenceRanges] = useState<ReferenceRangeFormItem[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (parameter) {
        setCode(parameter.code || '');
        setName(parameter.name || '');
        setShortName(parameter.short_name || '');
        setUnit(parameter.unit || '');
        setResultType(parameter.result_type || 'NUMBER');
        setDecimalPrecision(parameter.decimal_precision ?? 2);
        setDisplayOrder(parameter.display_order ?? 0);
        setReferenceRanges(
          (parameter.reference_ranges || []).map((rr) => ({
            id: rr.id,
            gender: rr.gender || '',
            age_min_years: rr.age_min_years ?? 0,
            age_max_years: rr.age_max_years ?? 150,
            min_value: rr.min_value !== null && rr.min_value !== undefined ? String(rr.min_value) : '',
            max_value: rr.max_value !== null && rr.max_value !== undefined ? String(rr.max_value) : '',
            critical_low: rr.critical_low !== null && rr.critical_low !== undefined ? String(rr.critical_low) : '',
            critical_high: rr.critical_high !== null && rr.critical_high !== undefined ? String(rr.critical_high) : '',
            text_normal_value: rr.text_normal_value || '',
            display_range_string: rr.display_range_string || '',
          }))
        );
      } else {
        setCode('');
        setName('');
        setShortName('');
        setUnit('');
        setResultType('NUMBER');
        setDecimalPrecision(2);
        setDisplayOrder(0);
        setReferenceRanges([
          {
            gender: '',
            age_min_years: 0,
            age_max_years: 150,
            min_value: '',
            max_value: '',
            display_range_string: '',
          },
        ]);
      }
    }
  }, [isOpen, parameter]);

  const handleAddRange = () => {
    setReferenceRanges([
      ...referenceRanges,
      {
        gender: '',
        age_min_years: 0,
        age_max_years: 150,
        min_value: '',
        max_value: '',
        display_range_string: '',
      },
    ]);
  };

  const handleRemoveRange = (idx: number) => {
    setReferenceRanges(referenceRanges.filter((_, i) => i !== idx));
  };

  const handleRangeChange = (idx: number, field: keyof ReferenceRangeFormItem, value: any) => {
    const updated = [...referenceRanges];
    updated[idx] = { ...updated[idx], [field]: value };
    setReferenceRanges(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setErrorMessage('Parameter code and name are required.');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload: any = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        short_name: shortName.trim() || null,
        unit: unit.trim() || null,
        result_type: resultType,
        decimal_precision: Number(decimalPrecision) || 0,
        display_order: Number(displayOrder) || 0,
        reference_ranges: referenceRanges
          .filter((rr) => rr.display_range_string.trim())
          .map((rr) => ({
            gender: rr.gender ? rr.gender : null,
            age_min_years: Number(rr.age_min_years) || 0,
            age_max_years: Number(rr.age_max_years) || 150,
            min_value: rr.min_value ? Number(rr.min_value) : null,
            max_value: rr.max_value ? Number(rr.max_value) : null,
            critical_low: rr.critical_low ? Number(rr.critical_low) : null,
            critical_high: rr.critical_high ? Number(rr.critical_high) : null,
            text_normal_value: rr.text_normal_value?.trim() || null,
            display_range_string: rr.display_range_string.trim(),
          })),
      };

      if (isEdit && parameter) {
        await testService.updateParameter(testId, parameter.id, payload);
        toast.success(`Parameter "${payload.name}" updated successfully.`);
      } else {
        await testService.addParameter(testId, payload);
        toast.success(`Parameter "${payload.name}" added successfully.`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save test parameter.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? `Edit Analyte Parameter [${parameter?.code}]` : `Add Sub-Analyte Parameter`}
      description={testName ? `Configure test parameter for ${testName}` : undefined}
      maxWidth="3xl"
    >
      {errorMessage && (
        <Alert type="error" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 px-1">
        {/* Code & Name */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Param Code *
            </label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. HB"
              className="uppercase font-mono"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Parameter Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hemoglobin"
              required
            />
          </div>
        </div>

        {/* Short Name, Unit, Result Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Short Name / Acronym
            </label>
            <Input
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="e.g. Hb"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Measurement Unit
            </label>
            <Input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. g/dL, mg/dL, %"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Result Value Type
            </label>
            <select
              value={resultType}
              onChange={(e) => setResultType(e.target.value as ResultValueType)}
              className="w-full text-sm rounded-lg border border-slate-300 py-2 px-3 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="NUMBER">Numeric Value</option>
              <option value="TEXT">Short Text</option>
              <option value="MULTILINE_TEXT">Multi-line Description</option>
              <option value="SELECT">Select Options</option>
              <option value="FORMULA">Calculated / Formula</option>
            </select>
          </div>
        </div>

        {/* Precision & Display Order */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Decimal Precision
            </label>
            <Input
              type="number"
              min="0"
              max="6"
              value={decimalPrecision}
              onChange={(e) => setDecimalPrecision(Number(e.target.value))}
              placeholder="2"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Display Sequence Order
            </label>
            <Input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              placeholder="0"
            />
          </div>
        </div>

        {/* Biological Reference Intervals */}
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Biological Reference Intervals
              </h4>
              <p className="text-[11px] text-slate-500">
                Define normal biological ranges and critical alert thresholds.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRange}
              className="flex items-center gap-1 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Range</span>
            </Button>
          </div>

          <div className="space-y-3">
            {referenceRanges.map((rr, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Interval #{idx + 1}
                  </span>
                  {referenceRanges.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRange(idx)}
                      className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Gender
                    </label>
                    <select
                      value={rr.gender || ''}
                      onChange={(e) => handleRangeChange(idx, 'gender', e.target.value || null)}
                      className="w-full text-xs rounded border border-slate-300 py-1.5 px-2 bg-white"
                    >
                      <option value="">All Genders</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Age Min (Yrs)
                    </label>
                    <input
                      type="number"
                      value={rr.age_min_years}
                      onChange={(e) => handleRangeChange(idx, 'age_min_years', Number(e.target.value))}
                      className="w-full text-xs rounded border border-slate-300 py-1.5 px-2"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Age Max (Yrs)
                    </label>
                    <input
                      type="number"
                      value={rr.age_max_years}
                      onChange={(e) => handleRangeChange(idx, 'age_max_years', Number(e.target.value))}
                      className="w-full text-xs rounded border border-slate-300 py-1.5 px-2"
                      placeholder="150"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-0.5">
                      Display Range *
                    </label>
                    <input
                      type="text"
                      value={rr.display_range_string}
                      onChange={(e) => handleRangeChange(idx, 'display_range_string', e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 py-1.5 px-2 font-medium"
                      placeholder="e.g. 13.0 - 17.0 g/dL"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">
                      Min Normal
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={rr.min_value}
                      onChange={(e) => handleRangeChange(idx, 'min_value', e.target.value)}
                      className="w-full text-xs rounded border border-slate-200 py-1 px-2"
                      placeholder="13.0"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">
                      Max Normal
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={rr.max_value}
                      onChange={(e) => handleRangeChange(idx, 'max_value', e.target.value)}
                      className="w-full text-xs rounded border border-slate-200 py-1 px-2"
                      placeholder="17.0"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-rose-600 mb-0.5">
                      Critical Low
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={rr.critical_low}
                      onChange={(e) => handleRangeChange(idx, 'critical_low', e.target.value)}
                      className="w-full text-xs rounded border border-rose-200 py-1 px-2 bg-rose-50/30"
                      placeholder="7.0"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-rose-600 mb-0.5">
                      Critical High
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={rr.critical_high}
                      onChange={(e) => handleRangeChange(idx, 'critical_high', e.target.value)}
                      className="w-full text-xs rounded border border-rose-200 py-1 px-2 bg-rose-50/30"
                      placeholder="20.0"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Parameter'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
