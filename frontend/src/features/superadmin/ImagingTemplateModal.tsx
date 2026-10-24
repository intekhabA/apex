import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Alert, toast, RichTextEditor } from '@/components/ui';
import { imagingService } from '@/api/imagingService';
import { testService } from '@/api/testService';
import { ImagingTemplate, DiagnosticTest } from '@/types';
import { Sparkles } from 'lucide-react';

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
  const isEditing = Boolean(templateToEdit && templateToEdit.id);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [modality, setModality] = useState('USG');
  const [testId, setTestId] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  // Tests list for linking
  const [availableTests, setAvailableTests] = useState<DiagnosticTest[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);

  // Status
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper to convert existing templates into one consolidated rich-text block
  const combineToSingleBox = (tpl: ImagingTemplate): string => {
    if (tpl.findings_template && /<[a-z][\s\S]*>/i.test(tpl.findings_template)) {
      return tpl.findings_template;
    }
    const parts: string[] = [];
    if (tpl.clinical_history_template?.trim()) {
      parts.push(
        `<div><b>CLINICAL HISTORY &amp; INDICATION:</b></div><div>${tpl.clinical_history_template.replace(/\n/g, '<br/>')}</div>`
      );
    }
    if (tpl.findings_template?.trim()) {
      parts.push(
        `<div><b>OBSERVATIONS &amp; FINDINGS:</b></div><div>${tpl.findings_template.replace(/\n/g, '<br/>')}</div>`
      );
    }
    if (tpl.impression_template?.trim()) {
      parts.push(
        `<div><b>IMPRESSION:</b></div><div><b>${tpl.impression_template.replace(/\n/g, '<br/>')}</b></div>`
      );
    }
    if (tpl.recommendations_template?.trim()) {
      parts.push(
        `<div><b>RECOMMENDATIONS &amp; ADVICE:</b></div><div>${tpl.recommendations_template.replace(/\n/g, '<br/>')}</div>`
      );
    }
    return parts.length > 0 ? parts.join('<div><br/></div>') : tpl.findings_template || '';
  };

  useEffect(() => {
    if (isOpen) {
      loadTests();
      if (templateToEdit) {
        setName(templateToEdit.name);
        setCode(templateToEdit.code);
        setModality(templateToEdit.modality);
        setTestId(templateToEdit.test_id || '');
        setTemplateContent(combineToSingleBox(templateToEdit));
        setDisplayOrder(templateToEdit.display_order ?? 0);
        setIsActive(templateToEdit.is_active ?? true);
      } else {
        setName('');
        setCode('');
        setModality('USG');
        setTestId('');
        setTemplateContent('');
        setDisplayOrder(0);
        setIsActive(true);
      }
      setErrorMessage(null);
    }
  }, [isOpen, templateToEdit]);

  const loadTests = async () => {
    setLoadingTests(true);
    try {
      const tests = await testService.getAllTests();
      setAvailableTests(tests);
    } catch {
      // fallback
    } finally {
      setLoadingTests(false);
    }
  };

  const handleNameChange = (val: string) => {
    setName(val);
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
    const strippedText = templateContent.replace(/<[^>]*>/g, '').trim();
    if (!strippedText || strippedText.length < 5) {
      setErrorMessage('Please provide template content in the editor box (minimum 5 characters).');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      modality: modality.trim().toUpperCase(),
      test_id: testId || null,
      clinical_history_template: null,
      findings_template: templateContent.trim(),
      impression_template: null,
      recommendations_template: null,
      is_active: isActive,
      display_order: Number(displayOrder) || 0,
    };

    try {
      if (isEditing && templateToEdit?.id) {
        await imagingService.updateTemplate(templateToEdit.id, payload);
        toast.success(`Template "${name}" updated successfully.`);
      } else {
        await imagingService.createTemplate(payload);
        toast.success(`Template "${name}" saved to laboratory successfully.`);
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
      title={
        isEditing
          ? `Edit Template: ${templateToEdit?.name}`
          : templateToEdit
          ? `Customize & Save Template: ${templateToEdit?.name}`
          : 'Create Diagnostic Template'
      }
      description="Configure standardized radiography and ultrasound observations, impressions, and findings in a single formatted editor box."
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

        {/* Unified One-Box Rich Text Editor */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-600" />
              Standard Radiology / Ultrasound Template (All-in-One Editor) <span className="text-rose-500">*</span>
            </label>
            <span className="text-xs text-slate-400">Use toolbar to bold, italicize, bullet, or insert quick sections</span>
          </div>

          <RichTextEditor
            value={templateContent}
            onChange={setTemplateContent}
            placeholder="Type or format your template observations, findings, and impressions here. Use bold (Ctrl+B) for organ names and impressions..."
            minHeight="min-h-[340px]"
          />
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
