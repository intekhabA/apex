import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Search, Plus, Filter, ChevronRight, Download } from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { bookingService } from '@/api/bookingService';
import { Booking, BookingStatus } from '@/types';
import { CreateBookingModal } from './CreateBookingModal';
import { BookingDetailsModal } from './BookingDetailsModal';

export const BookingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [downloadingBookingId, setDownloadingBookingId] = useState<string | null>(null);

  const handleDownloadAllReports = async (b: Booking, e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloadingBookingId(b.id);
    try {
      await bookingService.downloadAllReportsPdf(
        b.id,
        `Booking_${b.booking_id_display}_All_Reports.pdf`
      );
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to download consolidated reports PDF.');
    } finally {
      setDownloadingBookingId(null);
    }
  };

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['bookings', statusFilter, searchQuery],
    queryFn: () =>
      bookingService.getBookings({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as BookingStatus),
        search: searchQuery || undefined,
      }),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['samples'] });
  };

  const getStatusBadgeVariant = (st: BookingStatus) => {
    switch (st) {
      case 'COMPLETED':
        return 'normal';
      case 'PROCESSING':
      case 'SAMPLE_COLLECTED':
        return 'brand';
      case 'CONFIRMED':
        return 'teal';
      case 'CANCELLED':
        return 'high';
      default:
        return 'low';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-brand-600" />
            Diagnostic Orders & Bookings
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create multi-test bookings, track order fulfillment, and monitor payments.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Order / Booking
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by patient name, patient ID, phone, booking ID, or doctor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="SAMPLE_COLLECTED">Sample Collected</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : bookings.length === 0 ? (
        <Card className="py-12 text-center text-slate-500">
          <CalendarDays className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700">No diagnostic orders found</p>
          <p className="text-xs text-slate-400 mt-1">Create an order or adjust your status filter</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Order ID</th>
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Appointment</th>
                  <th className="px-4 py-3 text-left">Items</th>
                  <th className="px-4 py-3 text-left">Order Status</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-xs text-brand-700 whitespace-nowrap">
                      {b.booking_id_display}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 text-sm">
                        {b.patient_name || 'Patient'}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        {b.patient_id_display && (
                          <span className="font-mono text-slate-600 bg-slate-100 px-1 py-0.5 rounded text-[11px]">
                            {b.patient_id_display}
                          </span>
                        )}
                        {(b.patient_gender || b.patient_age_years != null) && (
                          <span>
                            {[
                              b.patient_gender
                                ? b.patient_gender === 'MALE'
                                  ? 'M'
                                  : b.patient_gender === 'FEMALE'
                                  ? 'F'
                                  : b.patient_gender
                                : null,
                              b.patient_age_years != null ? `${b.patient_age_years}y` : null,
                            ]
                              .filter(Boolean)
                              .join('/')}
                          </span>
                        )}
                        {b.patient_phone && (
                          <span className="text-slate-400">· {b.patient_phone}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                      <span className="font-medium">{b.appointment_date}</span>
                      {b.appointment_time && (
                        <span className="text-xs text-slate-400 ml-1.5">{b.appointment_time}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{b.items?.length || 0} items</span>
                      <span className="text-xs text-slate-400 ml-1">
                        ({b.items?.map((it) => it.item_name).slice(0, 2).join(', ')}
                        {(b.items?.length || 0) > 2 ? '...' : ''})
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Badge variant={getStatusBadgeVariant(b.status)}>{b.status}</Badge>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Badge
                        variant={
                          b.payment_status === 'PAID'
                            ? 'normal'
                            : b.payment_status === 'PARTIAL'
                            ? 'low'
                            : 'high'
                        }
                      >
                        {b.payment_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      ₹{Number(b.grand_total).toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold whitespace-nowrap">
                      <span className={Number(b.balance_amount) > 0 ? 'text-rose-600' : 'text-slate-400'}>
                        ₹{Number(b.balance_amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => handleDownloadAllReports(b, e)}
                          isLoading={downloadingBookingId === b.id}
                          className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 flex items-center gap-1 shadow-sm"
                          title="Download all reports for this booking in one PDF"
                        >
                          <Download className="w-3 h-3 text-teal-600" />
                          All Reports PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedBooking(b)}
                          className="text-xs flex items-center gap-1"
                        >
                          Details
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modals */}
      <CreateBookingModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleRefresh}
      />

      <BookingDetailsModal
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onSuccess={handleRefresh}
        booking={selectedBooking}
      />
    </div>
  );
};
