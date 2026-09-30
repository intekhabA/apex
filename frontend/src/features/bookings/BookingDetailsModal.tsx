import React, { useState } from 'react';
import { Modal, Button, Badge } from '@/components/ui';
import { bookingService } from '@/api/bookingService';
import { Booking, BookingStatus } from '@/types';
import { Download, FileText } from 'lucide-react';

export interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  booking: Booking | null;
}

export const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  booking,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  if (!booking) return null;

  const handleDownloadAllReports = async () => {
    setIsDownloadingPdf(true);
    try {
      await bookingService.downloadAllReportsPdf(
        booking.id,
        `Booking_${booking.booking_id_display}_All_Reports.pdf`
      );
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to download consolidated reports PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleStatusChange = async (newStatus: BookingStatus) => {
    setIsUpdating(true);
    try {
      await bookingService.updateBookingStatus(booking.id, newStatus);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update status.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    setIsUpdating(true);
    try {
      await bookingService.cancelBooking(booking.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to cancel booking.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Booking Order: ${booking.booking_id_display}`}
      maxWidth="lg"
    >
      <div className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
        {/* Header Status */}
        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div>
            <span className="text-xs text-slate-500 block">Current Status</span>
            <Badge variant="brand" className="mt-1">
              {booking.status}
            </Badge>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Payment State</span>
            <Badge
              variant={
                booking.payment_status === 'PAID'
                  ? 'normal'
                  : booking.payment_status === 'PARTIAL'
                  ? 'low'
                  : 'high'
              }
              className="mt-1"
            >
              {booking.payment_status}
            </Badge>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Appointment</span>
            <span className="text-xs font-semibold text-slate-800">
              {booking.appointment_date} {booking.appointment_time || ''}
            </span>
          </div>
        </div>

        {/* Consolidated Report Download Banner */}
        <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-lg p-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-100 rounded-md text-teal-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-teal-900 block">
                Consolidated Medical Report (Single PDF)
              </span>
              <span className="text-[11px] text-teal-700">
                Download all diagnostic test panels, analytes, and imaging findings for this booking in one document.
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAllReports}
            isLoading={isDownloadingPdf}
            className="flex items-center gap-1.5 text-xs font-semibold text-teal-800 border-teal-300 bg-white hover:bg-teal-100/60 shadow-sm whitespace-nowrap ml-3"
          >
            <Download className="w-3.5 h-3.5 text-teal-600" />
            Download PDF
          </Button>
        </div>

        {/* Included Items */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Ordered Items ({booking.items?.length || 0})
          </h4>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold">
                <tr>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Item Name</th>
                  <th className="px-3 py-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {booking.items?.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">
                      <Badge variant="slate" className="text-[10px]">
                        {item.item_type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-800">{item.item_name}</td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                      ₹{Number(item.final_price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="bg-slate-900 text-white p-4 rounded-xl space-y-1.5 text-xs font-mono">
          <div className="flex justify-between text-slate-400">
            <span>Subtotal:</span>
            <span>₹{Number(booking.subtotal_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Discount:</span>
            <span>- ₹{Number(booking.discount_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Tax:</span>
            <span>+ ₹{Number(booking.tax_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-emerald-400 pt-1 border-t border-slate-800">
            <span>Grand Total:</span>
            <span>₹{Number(booking.grand_total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Paid Amount:</span>
            <span>₹{Number(booking.paid_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-rose-400 pt-1 border-t border-slate-800">
            <span>Balance Due:</span>
            <span>₹{Number(booking.balance_amount).toFixed(2)}</span>
          </div>
        </div>

        {/* Status Actions */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          {booking.status !== 'CANCELLED' && booking.status !== 'COMPLETED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isUpdating}
              className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
            >
              Cancel Booking
            </Button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {booking.status === 'PENDING' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleStatusChange('CONFIRMED')}
                disabled={isUpdating}
                className="text-xs"
              >
                Confirm Order
              </Button>
            )}
            {booking.status === 'CONFIRMED' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleStatusChange('PROCESSING')}
                disabled={isUpdating}
                className="text-xs"
              >
                Mark In Processing
              </Button>
            )}
            {booking.status === 'PROCESSING' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleStatusChange('COMPLETED')}
                disabled={isUpdating}
                className="text-xs"
              >
                Mark Completed
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
