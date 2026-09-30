import React, { useState, useEffect, useMemo } from 'react';
import { Card, Input, Badge, Button, Alert } from '@/components/ui';
import { auditService } from '@/api/auditService';
import { AuditLog } from '@/types/audit';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Activity,
  ChevronDown,
  ChevronUp,
  Globe,
} from 'lucide-react';

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await auditService.getAuditLogs({
        action: actionFilter || undefined,
        entity_name: entityFilter || undefined,
      });
      setLogs(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setErrorMessage(errorObj.response?.data?.message || 'Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, entityFilter]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const s = search.toLowerCase();
      if (!s) return true;
      return (
        log.action.toLowerCase().includes(s) ||
        log.entity_name.toLowerCase().includes(s) ||
        (log.user_email && log.user_email.toLowerCase().includes(s)) ||
        (log.entity_id && log.entity_id.toLowerCase().includes(s)) ||
        (log.ip_address && log.ip_address.toLowerCase().includes(s))
      );
    });
  }, [logs, search]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getActionBadgeVariant = (
    action: string
  ): 'normal' | 'low' | 'high' | 'critical' | 'pending' | 'final' | 'brand' | 'slate' | 'teal' => {
    const act = action.toUpperCase();
    if (act.includes('DELETE') || act.includes('REJECT')) return 'high';
    if (act.includes('CREATE') || act.includes('APPROVE') || act.includes('FINALIZE')) return 'normal';
    if (act.includes('UPDATE') || act.includes('COLLECT')) return 'low';
    return 'slate';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Audit Trail</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Immutable, cryptographically logged record of state changes, user interactions, and security events.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={fetchLogs} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Trail
          </Button>
        </div>
      </div>

      {errorMessage && (
        <Alert type="error" title="Audit Log Error">
          {errorMessage}
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-gray-50/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Search by action, email, IP, or entity ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <div className="relative">
            <Filter className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Filter by action (e.g. CREATE_BOOKING)..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
          <div className="relative">
            <Activity className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Filter by entity (e.g. Booking, Report)..."
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="pl-9 bg-white"
            />
          </div>
        </div>
      </Card>

      {/* Audit Logs Table */}
      <Card className="overflow-hidden border border-gray-200">
        {loading ? (
          <div className="p-12 text-center text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-600" />
            <p>Loading audit events from secure ledger...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-medium">No audit entries found</p>
            <p className="text-sm mt-1">Actions performed by authenticated users will automatically be logged here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Client IP</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  const dateStr = new Date(log.created_at).toLocaleString();
                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <span>{dateStr}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getActionBadgeVariant(log.action)} className="font-mono text-xs">
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-gray-900">{log.entity_name}</span>
                          {log.entity_id && (
                            <span className="text-xs text-gray-400 block font-mono">
                              #{log.entity_id.slice(0, 8)}...
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <div>
                              <p className="text-gray-900 font-medium">{log.user_email || 'System'}</p>
                              {log.user_role && (
                                <span className="text-xs text-gray-500 font-mono">{log.user_role}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-gray-500 font-mono text-xs">
                            <Globe className="w-3.5 h-3.5 text-gray-400" />
                            {log.ip_address || 'Internal / N/A'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(log.id)}
                            className="text-xs gap-1"
                          >
                            {isExpanded ? (
                              <>
                                Hide <ChevronUp className="w-3.5 h-3.5" />
                              </>
                            ) : (
                              <>
                                Diff <ChevronDown className="w-3.5 h-3.5" />
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/60 border-b border-gray-200">
                          <td colSpan={6} className="py-4 px-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                              <div className="p-3 bg-white border border-gray-200 rounded-lg">
                                <p className="font-bold text-gray-700 mb-1">State Before:</p>
                                <pre className="overflow-x-auto text-gray-600 max-h-48">
                                  {log.before_state_json
                                    ? JSON.stringify(log.before_state_json, null, 2)
                                    : 'None / N/A'}
                                </pre>
                              </div>
                              <div className="p-3 bg-white border border-gray-200 rounded-lg">
                                <p className="font-bold text-gray-700 mb-1">State After:</p>
                                <pre className="overflow-x-auto text-gray-600 max-h-48">
                                  {log.after_state_json
                                    ? JSON.stringify(log.after_state_json, null, 2)
                                    : 'None / N/A'}
                                </pre>
                              </div>
                            </div>
                            {log.user_agent && (
                              <p className="mt-2 text-xs text-gray-400 font-sans">
                                User Agent: <span className="font-mono">{log.user_agent}</span>
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
