import React, { useState } from 'react';
import { Modal, Button, toast } from '@/components/ui';
import { reportService } from '@/api/reportService';
import { Printer, FileText, ExternalLink, Sparkles, Check, SlidersHorizontal } from 'lucide-react';

export interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string | null;
  reportDisplayId?: string | null;
  patientName?: string | null;
  testName?: string | null;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  reportId,
  reportDisplayId,
  patientName,
  testName,
}) => {
  const [printMode, setPrintMode] = useState<'LETTERHEAD' | 'PLAIN'>('LETTERHEAD');
  const [topMarginMm, setTopMarginMm] = useState<number>(48);
  const [bottomMarginMm, setBottomMarginMm] = useState<number>(28);
  const [showAdvancedMargins, setShowAdvancedMargins] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);

  if (!reportId) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const isLetterhead = printMode === 'LETTERHEAD';
      await reportService.printReport(reportId, {
        letterhead: isLetterhead,
        top_margin_mm: isLetterhead ? topMarginMm : undefined,
        bottom_margin_mm: isLetterhead ? bottomMarginMm : undefined,
      });
      toast.success('Print job dispatched to printer.');
      onClose();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string; message?: string } } };
      toast.error(
        errorObj.response?.data?.detail ||
          errorObj.response?.data?.message ||
          'Failed to send report to printer.'
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePreviewInTab = async () => {
    setIsPreviewing(true);
    try {
      const isLetterhead = printMode === 'LETTERHEAD';
      const blob = await reportService.getReportPdfBlob(reportId, {
        letterhead: isLetterhead,
        top_margin_mm: isLetterhead ? topMarginMm : undefined,
        bottom_margin_mm: isLetterhead ? bottomMarginMm : undefined,
      });
      const blobUrl = URL.createObjectURL(blob);
      const newTab = window.open(blobUrl, '_blank');
      if (!newTab) {
        toast.error('Pop-up blocked. Please allow pop-ups for this site.');
      }
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string; message?: string } } };
      toast.error(
        errorObj.response?.data?.detail ||
          errorObj.response?.data?.message ||
          'Failed to preview report PDF.'
      );
    } finally {
      setIsPreviewing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Print Medical Report: ${reportDisplayId || ''}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Report Summary Chip */}
        {(patientName || testName) && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Patient &amp; Test</span>
              <span className="font-semibold text-slate-800 text-sm">{patientName}</span>
              {testName && <span className="text-slate-500 block">{testName}</span>}
            </div>
            {reportDisplayId && (
              <div className="text-right">
                <span className="text-slate-400 block font-medium">Report No.</span>
                <span className="font-mono font-bold text-teal-700">{reportDisplayId}</span>
              </div>
            )}
          </div>
        )}

        {/* Paper / Printing Mode Selection */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Select Stationery / Print Layout:
          </label>

          {/* Option 1: Pre-printed Letterhead (Recommended) */}
          <div
            onClick={() => setPrintMode('LETTERHEAD')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
              printMode === 'LETTERHEAD'
                ? 'border-teal-500 bg-teal-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    printMode === 'LETTERHEAD'
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      Print on Pre-Printed A4 Letterhead
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-teal-600" /> Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Designed specifically for physical stationery with existing lab headers &amp; footers.
                    Omits the digital lab banner so text never prints over your pre-printed stationery.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-teal-800 font-medium mt-2">
                    <span>✓ Top Header Clearance: {topMarginMm} mm (~{(topMarginMm / 25.4).toFixed(1)} in)</span>
                    <span>✓ Bottom Footer Clearance: {bottomMarginMm} mm (~{(bottomMarginMm / 25.4).toFixed(1)} in)</span>
                  </div>
                </div>
              </div>

              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  printMode === 'LETTERHEAD'
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-slate-300'
                }`}
              >
                {printMode === 'LETTERHEAD' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>

            {/* Custom Margin Toggle */}
            {printMode === 'LETTERHEAD' && (
              <div className="mt-3 pt-3 border-t border-teal-200/60">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAdvancedMargins(!showAdvancedMargins);
                  }}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>
                    {showAdvancedMargins ? 'Hide margin adjustments' : 'Fine-tune letterhead margins'}
                  </span>
                </button>

                {showAdvancedMargins && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="grid grid-cols-2 gap-3 mt-2 bg-white p-3 rounded-lg border border-teal-200"
                  >
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Top Margin (mm)
                      </label>
                      <input
                        type="number"
                        min={20}
                        max={100}
                        value={topMarginMm}
                        onChange={(e) => setTopMarginMm(Number(e.target.value) || 48)}
                        className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400">Pre-printed header space</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Bottom Margin (mm)
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={80}
                        value={bottomMarginMm}
                        onChange={(e) => setBottomMarginMm(Number(e.target.value) || 28)}
                        className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400">Pre-printed footer space</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Option 2: Plain A4 Paper (Full Report) */}
          <div
            onClick={() => setPrintMode('PLAIN')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
              printMode === 'PLAIN'
                ? 'border-teal-500 bg-teal-50/50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    printMode === 'PLAIN'
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-sm">
                    Print on Plain A4 Paper (Full Report)
                  </span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Includes digital laboratory logo, header branding, contact information, accreditation
                    badges, and full footer details. Suitable for blank white paper.
                  </p>
                </div>
              </div>

              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  printMode === 'PLAIN'
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-slate-300'
                }`}
              >
                {printMode === 'PLAIN' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreviewInTab}
            isLoading={isPreviewing}
            disabled={isPrinting || isPreviewing}
            className="w-full sm:w-auto text-xs flex items-center gap-1.5 text-slate-600"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            <span>Open Preview in Tab</span>
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isPrinting || isPreviewing}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePrint}
              isLoading={isPrinting}
              disabled={isPrinting || isPreviewing}
              className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>
                {printMode === 'LETTERHEAD' ? 'Print on Letterhead' : 'Print Full Report'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
