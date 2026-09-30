import React, { useState, useEffect, useMemo } from 'react';
import { Card, Input, Badge, Alert } from '@/components/ui';
import { patientPortalService } from '@/api/patientPortalService';
import { BookingResponse } from '@/types/booking';
import { CalendarDays, Search, Clock, User } from 'lucide-react';

export const PatientBookingsPage: React.FC = () => {
  const [bookings, setBookings] = useState<BookingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await patientPortalService.getBookings();
      setBookings(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to fetch appointments.');
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const s = search.toLowerCase();
      const testNames = b.items.map((it: { item_name: string }) => it.item_name).join(' ').toLowerCase();
      return (
        search === '' ||
        b.booking_id_display.toLowerCase().includes(s) ||
        testNames.includes(s) ||
        (b.referring_doctor && b.referring_doctor.toLowerCase().includes(s))
      );
    });
  }, [bookings, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-blue-600" />
          Appointments & Diagnostic Orders
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Review your lab visit schedule, booked test panels, and order status.
        </p>
      </div>

      {errorMessage && (
        <Alert type="error" onDismiss={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      {/* Search Bar */}
      <Card className="p-4 bg-white border border-slate-200">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by booking #, doctor, or test name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      {/* Bookings List */}
      <Card className="overflow-hidden border border-slate-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading appointments...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-700">No appointments found</p>
            <p className="text-xs text-slate-400 mt-1">
              Your registered bookings and test orders will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Booking #</th>
                  <th className="p-3.5">Date & Time</th>
                  <th className="p-3.5">Tests Ordered</th>
                  <th className="p-3.5">Referring Doctor</th>
                  <th className="p-3.5 text-right">Grand Total</th>
                  <th className="p-3.5 text-center">Payment</th>
                  <th className="p-3.5 text-center">Order Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-semibold text-blue-700">
                      {b.booking_id_display}
                    </td>
                    <td className="p-3.5 text-slate-700 text-xs">
                      <div>{b.appointment_date}</div>
                      {b.appointment_time && (
                        <div className="text-slate-400 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {b.appointment_time}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-900 font-medium">
                      <div className="space-y-1">
                        {b.items.map((it: { id: string; item_name: string; final_price: number | string }) => (
                          <div key={it.id} className="text-xs flex items-center gap-2">
                            <span>• {it.item_name}</span>
                            <span className="text-slate-400">₹{Number(it.final_price).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600 text-xs">
                      {b.referring_doctor ? (
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {b.referring_doctor}
                        </div>
                      ) : (
                        'Self / Walk-in'
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="font-bold text-slate-900">₹{Number(b.grand_total).toFixed(2)}</div>
                      {Number(b.balance_amount) > 0 && (
                        <div className="text-[11px] text-amber-600">
                          Due: ₹{Number(b.balance_amount).toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <Badge
                        variant={
                          b.payment_status === 'PAID'
                            ? 'normal'
                            : b.payment_status === 'PARTIAL'
                            ? 'pending'
                            : 'high'
                        }
                      >
                        {b.payment_status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-center">
                      <Badge
                        variant={
                          b.status === 'COMPLETED'
                            ? 'normal'
                            : b.status === 'CANCELLED'
                            ? 'high'
                            : 'brand'
                        }
                      >
                        {b.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
