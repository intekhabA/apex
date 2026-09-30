import React, { useState } from 'react';
import { Modal, Button, Input, Alert } from '@/components/ui';
import { doctorService } from '@/api/doctorService';
import { DoctorCreatePayload } from '@/types/doctor';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const NewDoctorModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState<DoctorCreatePayload>({
    name: '',
    code: '',
    phone: '',
    email: '',
    specialization: '',
    clinic_hospital_name: '',
    default_commission_percentage: 10,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Doctor name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await doctorService.createDoctor(formData);
      onSuccess();
      onClose();
      setFormData({
        name: '',
        code: '',
        phone: '',
        email: '',
        specialization: '',
        clinic_hospital_name: '',
        default_commission_percentage: 10,
      });
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.response?.data?.message || 'Failed to create doctor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Referring Doctor"
      description="Register a doctor to calculate and track test referral commissions."
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={saving}>
            Save Doctor
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {error && <Alert type="error">{error}</Alert>}

        <div>
          <label className="block font-semibold text-slate-700 mb-1">
            Doctor Name <span className="text-rose-500">*</span>
          </label>
          <Input
            placeholder="e.g. Dr. Rajesh Sharma"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Specialization</label>
            <Input
              placeholder="e.g. Cardiologist, Physician"
              value={formData.specialization || ''}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Doctor Code / ID</label>
            <Input
              placeholder="e.g. DOC-101"
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
            <Input
              placeholder="+91 98765 43210"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
            <Input
              type="email"
              placeholder="doctor@hospital.com"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Clinic / Hospital Affiliation</label>
          <Input
            placeholder="e.g. City Health Clinic"
            value={formData.clinic_hospital_name || ''}
            onChange={(e) => setFormData({ ...formData, clinic_hospital_name: e.target.value })}
          />
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <label className="block font-semibold text-slate-900 mb-1">
            Default Baseline Commission Rate (%)
          </label>
          <p className="text-slate-500 mb-2 text-[11px]">
            This default percentage applies to all tests, unless you customize specific tests with individual percentages.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={formData.default_commission_percentage}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  default_commission_percentage: parseFloat(e.target.value) || 0,
                })
              }
              className="w-24 px-3 py-1.5 text-sm font-bold border border-slate-300 rounded-lg text-right"
              required
            />
            <span className="font-semibold text-slate-700">%</span>
          </div>
        </div>
      </form>
    </Modal>
  );
};
