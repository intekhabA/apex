import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Alert, toast } from '@/components/ui';
import { imagingService } from '@/api/imagingService';
import { testService } from '@/api/testService';
import { ImagingTemplate, DiagnosticTest } from '@/types';
import { FileText, Sparkles } from 'lucide-react';

export interface ImagingTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  templateToEdit?: ImagingTemplate | null;
}

export const ImagingTemplateModal: React.FC<ImagingTemplateModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  templateToEdit,
}) => {
  const isEditing = Boolean(templateToEdit);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [modality, setModality] = useState('USG');
  const [testId, setTestId] = useState('');
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  // Tests list for linking
  const [availableTests, setAvailableTests] = useState<DiagnosticTest[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTests();
      if (templateToEdit) {
        setName(templateToEdit.name);
        setCode(templateToEdit.code);
        setModality(templateToEdit.modality);
        setTestId(templateToEdit.test_id || '');
        setClinicalHistory(templateToEdit.clinical_history_template || '');
        setFindings(templateToEdit.findings_template || '');
        setImpression(templateToEdit.impression_template || '');
        setRecommendations(templateToEdit.recommendations_template || '');
        setDisplayOrder(templateToEdit.display_order ?? 0);
        setIsActive(templateToEdit.is_active ?? true);
      } else {
        setName('');
        setCode('');
        setModality('USG');
        setTestId('');
        setClinicalHistory('');
        setFindings('');
        setImpression('');
        setRecommendations('');
        setDisplayOrder(0);
        setIsActive(true);
      }
      setErrorMessage(null);
    }
  }, [isOpen, templateToEdit]);

  const loadTests = async () => {
    setLoadingTests(true);
    try {
      const tests = await testService.getTests();
      // Prioritize radiology & imaging tests
      setAvailableTests(tests);
    } catch {
      // fallback
    } finally {
      setLoadingTests(false);
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
    // Auto-generate code if adding new
    if (!isEditing && (!code || code === generateCode(name))) {
      setCode(generateCode(val));
    }
  };

  const generateCode = (text: string) => {
    return text
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Please provide a template name.');
      return;
    }
    if (!code.trim()) {
      setErrorMessage('Please provide a unique template code.');
      return;
    }
    if (!findings.trim() || findings.trim().length < 5) {
      setErrorMessage('Please provide clinical findings template content.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      modality: modality.trim().toUpperCase(),
      test_id: testId || null,
      clinical_history_template: clinicalHistory.trim() || null,
      findings_template: findings.trim(),
      impression_template: impression.trim() || null,
      recommendations_template: recommendations.trim() || null,
      is_active: isActive,
      display_order: Number(displayOrder) || 0,
    };

    try {
      if (isEditing && templateToEdit) {
        await imagingService.updateTemplate(templateToEdit.id, payload);
        toast.success(`Template "${name}" updated successfully.`);
      } else {
        await imagingService.createTemplate(payload);
        toast.success(`New template "${name}" created successfully.`);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string; message?: string } } };
      const msg =
        errorObj.response?.data?.detail ||
        errorObj.response?.data?.message ||
        'Failed to save imaging template.';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Imaging Template: ${templateToEdit?.name}` : 'Create New Imaging / X-Ray / USG Template'}
      description="Configure standardized anatomical observations, indications, and conclusions for diagnostic radiology."
      maxWidth="4xl"
    >
      {errorMessage && (
        <Alert type="error" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 px-1">
        {/* Core Identifiers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Template Name <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. USG Whole Abdomen, Chest X-Ray PA View"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Unique Template Code <span className="text-rose-500">*</span>
            </label>
            <Input
              placeholder="e.g. USG_WHOLE_ABDOMEN, CHEST_XRAY_PA"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
          </div>
        </div>

        {/* Modality & Linked Test */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Imaging Modality <span className="text-rose-500">*</span>
            </label>
            <select
              value={modality}
              onChange={(e) => setModality(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
            >
              <option value="USG">USG (Ultrasound / Sonography / Doppler)</option>
              <option value="X-RAY">X-RAY (Digital Radiography CR / DR)</option>
              <option value="CT">CT (Computed Tomography)</option>
              <option value="MRI">MRI (Magnetic Resonance Imaging)</option>
              <option value="ECG">ECG / Cardiology Tracing</option>
              <option value="OTHER">Other Diagnostic Study</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Link to Master Catalog Test (Optional)
            </label>
            <select
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              disabled={loadingTests}
            >
              <option value="">-- General / Multi-Test Template --</option>
              {availableTests.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.code}] {t.name} ({t.test_type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Display Order & Active Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Display Sort Order
            </label>
            <input
              type="number"
              min={0}
              value={displayOrder}
              onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
              className="w-32 px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-500"
            />
            <span className="text-xs text-slate-400 ml-2">Lower numbers appear first</span>
          </div>

          <div className="flex items-center gap-3 pt-2 sm:pt-0 sm:justify-end">
            <label className="relative flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ml-3 text-sm font-semibold text-slate-800">
                {isActive ? 'Active (Available in Worklist)' : 'Inactive (Hidden)'}
              </span>
            </label>
          </div>
        </div>

        {/* Clinical History / Indication */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            Clinical History &amp; Indication Template
          </label>
          <textarea
            rows={2}
            value={clinicalHistory}
            onChange={(e) => setClinicalHistory(e.target.value)}
            placeholder="e.g. Patient presents with acute abdominal pain / routine pre-operative screening."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-sans"
          />
        </div>

        {/* Organ-by-organ Findings */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              Standard Anatomical / Organ Findings Template <span className="text-rose-500">*</span>
            </label>
            <span className="text-xs text-slate-400">Organ-by-organ structure</span>
          </div>
          <textarea
            rows={8}
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            placeholder={`LIVER: Normal size and shape. Normal parenchymal echogenicity. No focal lesion.\nGALLBLADDER: Normal wall thickness. Lumen is clear of calculi.\nPANCREAS: Unremarkable.\nSPLEEN: Normal in size.\nKIDNEYS: Both kidneys are normal in size, shape, and position.`}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500 bg-slate-50/50"
            required
          />
        </div>

        {/* Impression & Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Radiological Impression / Conclusion Template
            </label>
            <textarea
              rows={3}
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              placeholder="e.g. Normal whole abdomen ultrasound study. No focal lesion or calculus noted."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Advice &amp; Recommendations Template
            </label>
            <textarea
              rows={3}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              placeholder="e.g. Clinical and biochemical correlation advised / follow-up as indicated."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-sans"
            />
          </div>
        </div>

        {/* Form Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={submitting}>
            {isEditing ? 'Save Changes' : 'Create Template'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
