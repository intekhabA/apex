import React, { useState, useEffect } from 'react';
import { Button, Input, Badge, confirmDialog, toast, LoadingSpinner } from '@/components/ui';
import { imagingService } from '@/api/imagingService';
import { ImagingTemplate } from '@/types';
import { ImagingTemplateModal } from './ImagingTemplateModal';
import {
  FileText,
  Plus,
  Search,
  Edit2,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Scan,
} from 'lucide-react';

export const ImagingTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<ImagingTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedModality, setSelectedModality] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templateToEdit, setTemplateToEdit] = useState<ImagingTemplate | null>(null);

  // Expanded items for viewing details
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await imagingService.listAdminTemplates();
      setTemplates(data);
    } catch {
      toast.error('Failed to load imaging templates.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setTemplateToEdit(null);
    setIsModalOpen(true);
  };

  const handleEdit = (tpl: ImagingTemplate) => {
    setTemplateToEdit(tpl);
    setIsModalOpen(true);
  };

  const handleDelete = async (tpl: ImagingTemplate) => {
    const confirmed = await confirmDialog({
      title: `Delete Template: ${tpl.name}`,
      message: `Are you sure you want to permanently delete the template "${tpl.name}" [${tpl.code}]? Reports already finalized with this template will not be affected.`,
      confirmText: 'Delete Template',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await imagingService.deleteTemplate(tpl.id);
      toast.success(`Template "${tpl.name}" deleted.`);
      fetchTemplates();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string; message?: string } } };
      toast.error(errorObj.response?.data?.detail || 'Failed to delete template.');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesModality = selectedModality === 'ALL' || t.modality === selectedModality;
    const term = search.toLowerCase().trim();
    const matchesSearch =
      !term ||
      t.name.toLowerCase().includes(term) ||
      t.code.toLowerCase().includes(term) ||
      t.findings_template.toLowerCase().includes(term) ||
      (t.impression_template && t.impression_template.toLowerCase().includes(term)) ||
      (t.test_name && t.test_name.toLowerCase().includes(term));
    return matchesModality && matchesSearch;
  });

  const getModalityBadge = (modality: string) => {
    switch (modality) {
      case 'USG':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800">USG / Sonography</span>;
      case 'X-RAY':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">X-Ray (CR/DR)</span>;
      case 'CT':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">CT Scan</span>;
      case 'MRI':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">MRI</span>;
      case 'ECG':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">ECG / Cardiology</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">{modality}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Scan className="w-7 h-7 text-brand-600" />
            Diagnostic X-Ray &amp; USG Reporting Templates
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure, edit, and add standardized organ-by-organ anatomical observation templates used by laboratories across the platform.
          </p>
        </div>

        <Button onClick={handleCreate} className="flex items-center gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          Add New Template
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            placeholder="Search templates by name, organ, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Modality Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {['ALL', 'USG', 'X-RAY', 'CT', 'MRI', 'ECG'].map((mod) => (
            <button
              key={mod}
              onClick={() => setSelectedModality(mod)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedModality === mod
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {mod === 'ALL' ? 'All Modalities' : mod}
            </button>
          ))}
        </div>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" label="Loading clinical templates..." />
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-sm space-y-3">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No imaging templates found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {search
              ? `No templates matched "${search}". Try adjusting your search query or modality filter.`
              : 'Get started by creating your first standardized radiology or ultrasound reporting template.'}
          </p>
          <Button onClick={handleCreate} size="sm" className="mt-2">
            <Plus className="w-4 h-4 mr-1.5" />
            Add New Template
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTemplates.map((tpl) => {
            const isExpanded = Boolean(expandedIds[tpl.id]);

            return (
              <div
                key={tpl.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Header */}
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                      <Scan className="w-5 h-5 text-brand-600" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-base">{tpl.name}</h3>
                        {getModalityBadge(tpl.modality)}
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                          {tpl.code}
                        </span>
                        {!tpl.is_active && (
                          <Badge variant="high">Inactive</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        {tpl.test_name ? (
                          <span className="text-brand-700 font-semibold">
                            Linked: [{tpl.test_code}] {tpl.test_name}
                          </span>
                        ) : (
                          <span className="text-slate-400">General Diagnostic Template</span>
                        )}
                        <span>•</span>
                        <span>Sort Order: {tpl.display_order}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleExpand(tpl.id)}
                      className="text-xs flex items-center gap-1 text-slate-600"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" /> Collapse
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" /> Preview Findings
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(tpl)}
                      className="text-xs flex items-center gap-1 text-slate-700"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(tpl)}
                      className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      title="Delete template"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Collapsible Content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
                    {/* Clinical History */}
                    {tpl.clinical_history_template && (
                      <div>
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                          Standard Indication / Clinical History:
                        </span>
                        <p className="text-xs text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200">
                          {tpl.clinical_history_template}
                        </p>
                      </div>
                    )}

                    {/* Findings */}
                    <div>
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                        Radiology Template Content:
                      </span>
                      {/<[a-z][\s\S]*>/i.test(tpl.findings_template) ? (
                        <div
                          className="text-xs bg-white p-3.5 rounded-lg border border-slate-200 text-slate-800 leading-relaxed font-sans [&_b]:font-bold [&_b]:text-slate-900 [&_h3]:font-bold [&_h3]:text-sm [&_h3]:mt-2 [&_h4]:font-bold [&_ul]:list-disc [&_ul]:pl-4"
                          dangerouslySetInnerHTML={{ __html: tpl.findings_template }}
                        />
                      ) : (
                        <pre className="text-xs font-mono bg-white p-3.5 rounded-lg border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                          {tpl.findings_template}
                        </pre>
                      )}
                    </div>

                    {/* Impression & Recommendations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {tpl.impression_template && (
                        <div>
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                            Impression Template:
                          </span>
                          <p className="text-xs text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200 font-medium">
                            {tpl.impression_template}
                          </p>
                        </div>
                      )}

                      {tpl.recommendations_template && (
                        <div>
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                            Advice / Recommendations Template:
                          </span>
                          <p className="text-xs text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200">
                            {tpl.recommendations_template}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Template Modal */}
      <ImagingTemplateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchTemplates();
        }}
        templateToEdit={templateToEdit}
      />
    </div>
  );
};
