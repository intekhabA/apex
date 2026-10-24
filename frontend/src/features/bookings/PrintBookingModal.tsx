import React, { useState } from 'react';
import { Modal, Button, toast } from '@/components/ui';
import { bookingService } from '@/api/bookingService';
import { Printer, FileText, ExternalLink, Sparkles, Check, SlidersHorizontal, Calendar, Layers } from 'lucide-react';

export interface PrintBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string | null;
  bookingDisplayId?: string | null;
  patientName?: string | null;
  itemCount?: number;
  appointmentDate?: string | null;
}

export const PrintBookingModal: React.FC<PrintBookingModalProps> = ({
  isOpen,
  onClose,
  bookingId,
  bookingDisplayId,
  patientName,
  itemCount,
  appointmentDate,
}) => {
  const [printMode, setPrintMode] = useState<'LETTERHEAD' | 'PLAIN'>('LETTERHEAD');
  const [topMarginMm, setTopMarginMm] = useState<number>(48);
  const [bottomMarginMm, setBottomMarginMm] = useState<number>(28);
  const [showAdvancedMargins, setShowAdvancedMargins] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isPreviewing, setIsPreviewing] = useState<boolean>(false);

  if (!bookingId) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const isLetterhead = printMode === 'LETTERHEAD';
      await bookingService.printBookingAllReports(bookingId, {
        letterhead: isLetterhead,
        top_margin_mm: isLetterhead ? topMarginMm : undefined,
        bottom_margin_mm: isLetterhead ? bottomMarginMm : undefined,
      });
      toast.success('All reports dispatched to printer.');
      onClose();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string; message?: string } } };
      toast.error(
        errorObj.response?.data?.detail ||
          errorObj.response?.data?.message ||
          'Failed to send consolidated reports to printer.'
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePreviewInTab = async () => {
    setIsPreviewing(true);
    try {
      const isLetterhead = printMode === 'LETTERHEAD';
      const blob = await bookingService.getBookingAllReportsBlob(bookingId, {
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
          'Failed to preview consolidated reports PDF.'
      );
    } finally {
      setIsPreviewing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Print All Reports: Booking #${bookingDisplayId || ''}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Booking Summary Chip */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Patient</span>
            <span className="font-semibold text-slate-800 text-sm">{patientName || 'Patient'}</span>
            <div className="flex items-center gap-3 text-slate-500 mt-0.5">
              {itemCount !== undefined && (
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-teal-600" />
                  {itemCount} {itemCount === 1 ? 'Test Panel' : 'Test Panels'}
                </span>
              )}
              {appointmentDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {appointmentDate}
                </span>
              )}
            </div>
          </div>
          {bookingDisplayId && (
            <div className="text-right">
              <span className="text-slate-400 block font-medium">Booking ID</span>
              <span className="font-mono font-bold text-teal-700">#{bookingDisplayId}</span>
            </div>
          )}
        </div>

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
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border mt-1 ${
                  printMode === 'LETTERHEAD'
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {printMode === 'LETTERHEAD' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
          </div>

          {/* Option 2: Plain A4 Paper */}
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
                    Print on Plain A4 Paper (Full Lab Header)
                  </span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Includes digital laboratory branding banner, clinic address, contact info, accreditation badges, and decorative divider.
                  </p>
                </div>
              </div>

              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border mt-1 ${
                  printMode === 'PLAIN'
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {printMode === 'PLAIN' && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Margin Fine-Tuning */}
        {printMode === 'LETTERHEAD' && (
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/60">
            <button
              type="button"
              onClick={() => setShowAdvancedMargins(!showAdvancedMargins)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-teal-700 w-full"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Fine-Tune Physical Stationery Margins</span>
              <span className="text-slate-400 font-normal ml-auto">
                {showAdvancedMargins ? 'Hide ▲' : 'Adjust ▼'}
              </span>
            </button>

            {showAdvancedMargins && (
              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200 text-xs">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Top Clearance Margin (mm):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={20}
                      max={100}
                      value={topMarginMm}
                      onChange={(e) => setTopMarginMm(Math.max(10, parseInt(e.target.value) || 0))}
                      className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-semibold text-center focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                    <span className="text-slate-500">mm (~{(topMarginMm / 25.4).toFixed(1)} in)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Standard letterhead header clearance is 48 mm.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-600 font-medium mb-1">
                    Bottom Clearance Margin (mm):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={10}
                      max={80}
                      value={bottomMarginMm}
                      onChange={(e) => setBottomMarginMm(Math.max(10, parseInt(e.target.value) || 0))}
                      className="w-20 px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-semibold text-center focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                    <span className="text-slate-500">mm (~{(bottomMarginMm / 25.4).toFixed(1)} in)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Standard letterhead footer clearance is 28 mm.
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreviewInTab}
            isLoading={isPreviewing}
            className="flex items-center gap-1.5 text-xs text-slate-700"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
            Open Preview in Tab
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isPrinting || isPreviewing}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePrint}
              isLoading={isPrinting}
              className="flex items-center gap-1.5 text-xs font-semibold px-4 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              Send to Printer
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
