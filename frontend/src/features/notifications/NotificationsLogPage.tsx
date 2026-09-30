import React, { useState, useEffect, useMemo } from 'react';
import { Card, Input, Badge, Button, Alert } from '@/components/ui';
import { notificationService } from '@/api/notificationService';
import { NotificationLog, NotificationEventType, NotificationChannel, NotificationStatus } from '@/types/notification';
import {
  Bell,
  Search,
  RefreshCw,
  Mail,
  MessageSquare,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  User,
} from 'lucide-react';

export const NotificationsLogPage: React.FC = () => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | NotificationChannel>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | NotificationStatus>('ALL');

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await notificationService.getNotifications({
        channel: channelFilter === 'ALL' ? undefined : channelFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setLogs(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to fetch notification logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelFilter, statusFilter]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const s = search.toLowerCase();
      if (!s) return true;
      return (
        log.recipient.toLowerCase().includes(s) ||
        (log.recipient_name && log.recipient_name.toLowerCase().includes(s)) ||
        (log.subject && log.subject.toLowerCase().includes(s)) ||
        log.message_body.toLowerCase().includes(s) ||
        log.event_type.toLowerCase().includes(s)
      );
    });
  }, [logs, search]);

  const getEventBadge = (type: NotificationEventType) => {
    switch (type) {
      case 'REPORT_FINALIZED':
        return <Badge variant="normal">REPORT FINALIZED</Badge>;
      case 'BOOKING_CREATED':
        return <Badge variant="brand">BOOKING CREATED</Badge>;
      case 'SAMPLE_COLLECTED':
        return <Badge variant="low">SPECIMEN COLLECTED</Badge>;
      case 'PAYMENT_RECEIVED':
        return <Badge variant="teal">PAYMENT RECEIVED</Badge>;
      default:
        return <Badge variant="slate">{type}</Badge>;
    }
  };

  const getChannelIcon = (channel: NotificationChannel) => {
    switch (channel) {
      case 'EMAIL':
        return <Mail className="w-4 h-4 text-blue-600" />;
      case 'SMS':
        return <MessageSquare className="w-4 h-4 text-amber-600" />;
      case 'WHATSAPP':
        return <Send className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-8 h-8 text-sky-600" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Notification & Alerts Log</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Real-time delivery status for automated patient communications (Email, SMS, and WhatsApp).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchLogs} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {errorMessage && (
        <Alert type="error" title="Communication Dispatch Error">
          {errorMessage}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-gray-50/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Search recipient, patient, or body..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <div>
            <select
              aria-label="Filter by notification channel"
              className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as 'ALL' | NotificationChannel)}
            >
              <option value="ALL">All Delivery Channels</option>
              <option value="EMAIL">Email (SMTP)</option>
              <option value="SMS">SMS Gateway</option>
              <option value="WHATSAPP">WhatsApp Business</option>
            </select>
          </div>
          <div>
            <select
              aria-label="Filter by delivery status"
              className="w-full h-10 px-3 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | NotificationStatus)}
            >
              <option value="ALL">All Delivery Statuses</option>
              <option value="SENT">Delivered / Sent</option>
              <option value="FAILED">Failed</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Notifications Table */}
      <Card className="overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-sky-600" />
            <p>Fetching communication dispatches...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-medium">No notification events recorded</p>
            <p className="text-sm mt-1">Dispatches on booking, collection, or finalization will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Subject / Message</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => {
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">{getEventBadge(log.event_type)}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-medium text-gray-700">
                          {getChannelIcon(log.channel)}
                          <span>{log.channel}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          <div>
                            <p className="font-semibold text-gray-900">{log.recipient_name || 'Patient'}</p>
                            <p className="text-xs text-gray-500 font-mono">{log.recipient}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        {log.subject && (
                          <p className="font-medium text-gray-800 text-xs mb-0.5">{log.subject}</p>
                        )}
                        <p className="text-xs text-gray-600 line-clamp-2">{log.message_body}</p>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {log.status === 'SENT' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle className="w-3 h-3" /> Delivered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3 h-3" /> {log.status}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-500 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
