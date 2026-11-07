import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Send,
  Search,
  Clock,
  RefreshCw,
  RotateCcw,
  Save,
  Tag,
  FileText,
  Eye,
  Phone,
  Building2,
} from 'lucide-react';
import { contactApi } from '@/api/contactService';
import { ContactQuery } from '@/types/contact';
import { Card, Button, Input, Badge, Pagination, toast, confirmDialog } from '@/components/ui';
import { formatDateTime } from '@/utils/formatters';

export const ContactManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'queries' | 'settings'>('queries');

  // Queries Filter & Pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [selectedQuery, setSelectedQuery] = useState<ContactQuery | null>(null);

  // Notes state for detail modal
  const [adminNotes, setAdminNotes] = useState('');

  // Settings State
  const [recipientEmail, setRecipientEmail] = useState('alam347709@gmail.com');
  const [supportEmail, setSupportEmail] = useState('support@trustmylab.in');
  const [contactPhone, setContactPhone] = useState('+91 94150 05517');
  const [officeAddress, setOfficeAddress] = useState('Cyber City, Block A, Gurugram, India');
  const [workingHours, setWorkingHours] = useState('Monday – Saturday: 8:00 AM – 8:00 PM IST');
  const [notifSubject, setNotifSubject] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(true);
  const [autoReplySubject, setAutoReplySubject] = useState('');
  const [autoReplyBody, setAutoReplyBody] = useState('');

  // 1. Fetch Queries
  const {
    data: queriesData,
    isLoading: loadingQueries,
  } = useQuery({
    queryKey: ['contactQueries', search, statusFilter, page],
    queryFn: () =>
      contactApi.listQueries({
        search: search || undefined,
        status_filter: statusFilter === 'ALL' ? undefined : statusFilter,
        page,
        limit: 15,
      }),
  });

  // 2. Fetch Settings & Templates
  const {
    data: settingsData,
  } = useQuery({
    queryKey: ['contactSettings'],
    queryFn: () => contactApi.getSettings(),
  });

  useEffect(() => {
    if (settingsData) {
      setRecipientEmail(settingsData.recipient_email || 'alam347709@gmail.com');
      setSupportEmail(settingsData.support_email || 'support@trustmylab.in');
      setContactPhone(settingsData.contact_phone || '+91 94150 05517');
      setOfficeAddress(settingsData.office_address || '');
      setWorkingHours(settingsData.working_hours || '');
      setNotifSubject(settingsData.notification_subject_template || '');
      setNotifBody(settingsData.notification_body_template || '');
      setAutoReplyEnabled(settingsData.auto_reply_enabled ?? true);
      setAutoReplySubject(settingsData.auto_reply_subject_template || '');
      setAutoReplyBody(settingsData.auto_reply_body_template || '');
    }
  }, [settingsData]);

  // Update Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: () =>
      contactApi.updateSettings({
        recipient_email: recipientEmail,
        support_email: supportEmail,
        contact_phone: contactPhone,
        office_address: officeAddress,
        working_hours: workingHours,
        notification_subject_template: notifSubject,
        notification_body_template: notifBody,
        auto_reply_enabled: autoReplyEnabled,
        auto_reply_subject_template: autoReplySubject,
        auto_reply_body_template: autoReplyBody,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['contactSettings'], updated);
      toast.success('Contact settings & email templates updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update settings');
    },
  });

  // Reset Templates Mutation
  const resetMutation = useMutation({
    mutationFn: () => contactApi.resetTemplates(),
    onSuccess: (updated) => {
      queryClient.setQueryData(['contactSettings'], updated);
      toast.success('Email templates reset to default sample templates.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to reset templates');
    },
  });

  // Test Email Mutation
  const testEmailMutation = useMutation({
    mutationFn: () => contactApi.sendTestEmail(),
    onSuccess: (res) => {
      toast.success(`Test email dispatched to ${res.recipient}!`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Test email failed');
    },
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      contactApi.updateQueryStatus(id, { status, admin_notes: notes }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['contactQueries'] });
      if (selectedQuery && selectedQuery.id === updated.id) {
        setSelectedQuery(updated);
      }
      toast.success('Inquiry updated successfully.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update status');
    },
  });

  const handleSelectQuery = (query: ContactQuery) => {
    setSelectedQuery(query);
    setAdminNotes(query.admin_notes || '');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return <Badge variant="brand">NEW INQUIRY</Badge>;
      case 'CONTACTED':
        return <Badge variant="low">CONTACTED</Badge>;
      case 'RESOLVED':
        return <Badge variant="normal">RESOLVED</Badge>;
      case 'SPAM':
        return <Badge variant="high">SPAM</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  const insertPlaceholder = (tag: string, target: 'notifSubject' | 'notifBody' | 'autoSubject' | 'autoBody') => {
    if (target === 'notifSubject') setNotifSubject((prev) => prev + tag);
    if (target === 'notifBody') setNotifBody((prev) => prev + tag);
    if (target === 'autoSubject') setAutoReplySubject((prev) => prev + tag);
    if (target === 'autoBody') setAutoReplyBody((prev) => prev + tag);
  };

  const placeholders = [
    '{user_name}',
    '{user_email}',
    '{user_phone}',
    '{organization_name}',
    '{service_interested}',
    '{subject}',
    '{message}',
    '{submitted_at}',
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="w-8 h-8 text-brand-600" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Contact Queries & Email Notifications
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Manage incoming prospective client inquiries and customize the delivery templates.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('queries')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'queries'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Inquiries & Leads{' '}
            {queriesData?.meta?.total !== undefined && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 text-[10px]">
                {queriesData.meta.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Email Templates & Mail Settings
          </button>
        </div>
      </div>

      {/* TAB 1: INQUIRIES & LEADS */}
      {activeTab === 'queries' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <Card className="p-4 bg-gray-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  placeholder="Search by name, email, organization, subject, or message..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 bg-white"
                />
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-10 px-3 py-2 text-sm bg-white border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="NEW">New Inquiries</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="SPAM">Spam</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Queries Table */}
          <Card className="overflow-hidden border border-gray-200">
            {loadingQueries ? (
              <div className="p-12 text-center text-gray-500">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-brand-600" />
                <p>Loading inquiries from secure inbox...</p>
              </div>
            ) : !queriesData || queriesData.items.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-base font-medium">No contact inquiries found</p>
                <p className="text-sm mt-1">Queries submitted on the public Contact Us form will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Inquirer</th>
                      <th className="py-3 px-4">Organization / Service</th>
                      <th className="py-3 px-4">Subject & Message</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {queriesData.items.map((q) => {
                      const dateStr = q.formatted_time || formatDateTime(q.created_at);
                      return (
                        <tr key={q.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap text-xs text-gray-600">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              <span>{dateStr}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <p className="font-semibold text-gray-900 text-sm">{q.name}</p>
                            <p className="text-xs text-brand-600 font-mono">{q.email}</p>
                            {q.phone && <p className="text-[11px] text-gray-500">{q.phone}</p>}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-medium text-gray-800 text-xs block">
                              {q.organization_name || 'Individual'}
                            </span>
                            <span className="text-[11px] text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded font-medium inline-block mt-0.5">
                              {q.service_interested || 'Diagnostic LIMS'}
                            </span>
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <p className="font-semibold text-xs text-gray-900 truncate">{q.subject}</p>
                            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{q.message}</p>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(q.status)}</td>

                          <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSelectQuery(q)}
                              className="text-xs gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> Details
                            </Button>
                            <a
                              href={`mailto:${q.email}?subject=Re: ${encodeURIComponent(q.subject)}`}
                              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-brand-50 text-brand-700 hover:bg-brand-100 font-semibold transition-colors"
                            >
                              <Send className="w-3 h-3" /> Reply
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Pagination */}
          {queriesData && queriesData.meta.total > 0 && (
            <Pagination
              page={page}
              limit={15}
              total={queriesData.meta.total}
              totalPages={queriesData.meta.total_pages}
              onPageChange={setPage}
            />
          )}

          {/* QUERY DETAIL MODAL */}
          {selectedQuery && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <Card className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-0">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Inquiry Details</h3>
                    <p className="text-xs text-slate-500 font-mono">ID: {selectedQuery.id}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedQuery(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </Button>
                </div>

                <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 font-bold block uppercase">Inquirer</span>
                      <p className="font-semibold text-slate-900 text-sm mt-0.5">{selectedQuery.name}</p>
                      <a href={`mailto:${selectedQuery.email}`} className="text-brand-600 hover:underline">
                        {selectedQuery.email}
                      </a>
                      {selectedQuery.phone && <p className="text-slate-600 mt-0.5">{selectedQuery.phone}</p>}
                    </div>

                    <div>
                      <span className="text-slate-400 font-bold block uppercase">Organization & Service</span>
                      <p className="font-semibold text-slate-900 mt-0.5">
                        {selectedQuery.organization_name || 'Individual / Not specified'}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-brand-100 text-brand-800 rounded font-semibold text-[11px]">
                        {selectedQuery.service_interested || 'Diagnostic LIMS'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-bold block uppercase">Submitted At</span>
                      <p className="text-slate-700 mt-0.5">
                        {selectedQuery.formatted_time || formatDateTime(selectedQuery.created_at)}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-400 font-bold block uppercase">Current Status</span>
                      <div className="mt-1">{getStatusBadge(selectedQuery.status)}</div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Subject
                    </label>
                    <p className="font-semibold text-sm text-slate-900 bg-slate-50 p-3 rounded-lg border border-slate-200">
                      {selectedQuery.subject}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Detailed Message / Requirements
                    </label>
                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {selectedQuery.message}
                    </div>
                  </div>

                  {/* Status Toggle & Admin Notes */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Update Lead Status
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['NEW', 'CONTACTED', 'RESOLVED', 'SPAM'].map((st) => (
                        <button
                          key={st}
                          onClick={() =>
                            updateStatusMutation.mutate({
                              id: selectedQuery.id,
                              status: st,
                              notes: adminNotes,
                            })
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            selectedQuery.status === st
                              ? 'bg-brand-600 text-white border-brand-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          Mark as {st}
                        </button>
                      ))}
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Internal Admin Notes (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Add private staff notes on this lead (e.g. called on phone, quoted Enterprise tier)..."
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                  <a
                    href={`mailto:${selectedQuery.email}?subject=Re: ${encodeURIComponent(selectedQuery.subject)}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-brand-600 text-white shadow-xs hover:bg-brand-700 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" /> Compose Email Reply
                  </a>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      updateStatusMutation.mutate({
                        id: selectedQuery.id,
                        status: selectedQuery.status,
                        notes: adminNotes,
                      });
                    }}
                    className="text-xs gap-1"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Notes
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EMAIL TEMPLATES & MAIL SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Public Contact Page Display Information */}
          <Card className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
            <div className="border-b pb-4">
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-600" /> Public Contact Page Display Information
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure the Support Email and Helpline Number displayed to visitors on the public <span className="font-mono text-slate-700">/contact</span> page.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-brand-600" /> Public Support Email *
                </label>
                <Input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  placeholder="support@trustmylab.in"
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Displayed as the official inquiries & support email on the contact page.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-teal-600" /> Public Helpline / Contact Number *
                </label>
                <Input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 94150 05517"
                  className="font-mono text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Displayed as the direct dial phone number on the contact page.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" /> Operating Hours & Response SLA
                </label>
                <Input
                  type="text"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  placeholder="Monday – Saturday: 8:00 AM – 8:00 PM IST"
                  className="text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Response SLA shown under the contact card.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" /> Office / Headquarters Address
                </label>
                <Input
                  type="text"
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                  placeholder="Cyber City, Block A, Gurugram, India"
                  className="text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Physical headquarters address for official correspondence.
                </p>
              </div>
            </div>
          </Card>

          {/* Recipient Destination Card */}
          <Card className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Mail className="w-4 h-4 text-brand-600" /> Inquiries Recipient Destination
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  The email address where all user queries and service requests will be delivered.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testEmailMutation.mutate()}
                  disabled={testEmailMutation.isPending}
                  className="text-xs gap-1.5"
                >
                  <Send className={`w-3.5 h-3.5 ${testEmailMutation.isPending ? 'animate-spin' : ''}`} />
                  Send Test Email
                </Button>
              </div>
            </div>

            <div className="max-w-xl">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Recipient Email Address *
              </label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="alam347709@gmail.com"
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Currently configured to deliver user queries directly to{' '}
                <span className="font-semibold text-brand-700 font-mono">{recipientEmail}</span>.
              </p>
            </div>
          </Card>

          {/* Notification Email Template (To Admin) */}
          <Card className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-600" /> Admin Notification Email Template
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  This template determines how the message arriving at{' '}
                  <span className="font-mono text-slate-700">{recipientEmail}</span> is formatted.
                </p>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const confirmed = await confirmDialog({
                    title: 'Reset to Sample Template?',
                    message:
                      'This will restore the factory default sample templates for notification and auto-reply.',
                    confirmText: 'Reset Templates',
                  });
                  if (confirmed) {
                    resetMutation.mutate();
                  }
                }}
                disabled={resetMutation.isPending}
                className="text-xs gap-1 text-slate-500 hover:text-rose-600"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to Default Sample
              </Button>
            </div>

            {/* Placeholders helper toolbar */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-400" /> Click to Insert Placeholder Variable into Template:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {placeholders.map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(ph, 'notifBody')}
                    className="px-2 py-1 bg-white border border-slate-300 hover:border-brand-500 hover:text-brand-600 text-slate-700 font-mono text-xs rounded transition-all shadow-2xs"
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Subject Line Template
                </label>
                <Input
                  value={notifSubject}
                  onChange={(e) => setNotifSubject(e.target.value)}
                  placeholder="New Service Inquiry: {subject} — From {user_name}"
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Body Content Template
                </label>
                <textarea
                  rows={10}
                  value={notifBody}
                  onChange={(e) => setNotifBody(e.target.value)}
                  className="w-full font-mono text-xs p-3.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                />
              </div>
            </div>
          </Card>

          {/* Auto-Reply Email Template (To User) */}
          <Card className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    Visitor Auto-Acknowledgment Receipt
                  </h3>
                  <label className="inline-flex items-center cursor-pointer ml-3">
                    <input
                      type="checkbox"
                      checked={autoReplyEnabled}
                      onChange={(e) => setAutoReplyEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-600"></div>
                    <span className="ml-2 text-xs font-semibold text-slate-700">
                      {autoReplyEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </label>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automatically emails a polite confirmation receipt to the user who submitted the inquiry.
                </p>
              </div>
            </div>

            {autoReplyEnabled && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Auto-Reply Subject Template
                  </label>
                  <Input
                    value={autoReplySubject}
                    onChange={(e) => setAutoReplySubject(e.target.value)}
                    placeholder="We have received your inquiry — TrustMyLab Clinical Systems"
                    className="font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Auto-Reply Body Content Template
                  </label>
                  <textarea
                    rows={8}
                    value={autoReplyBody}
                    onChange={(e) => setAutoReplyBody(e.target.value)}
                    className="w-full font-mono text-xs p-3.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Bottom Save Bar */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="primary"
              onClick={() => saveSettingsMutation.mutate()}
              disabled={saveSettingsMutation.isPending}
              className="px-6 gap-2 text-sm shadow-md shadow-brand-600/20"
            >
              <Save className={`w-4 h-4 ${saveSettingsMutation.isPending ? 'animate-spin' : ''}`} />
              Save Contact Settings & Templates
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
