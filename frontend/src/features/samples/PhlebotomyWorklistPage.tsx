import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pipette, Search, Filter } from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { sampleService } from '@/api/sampleService';
import { SpecimenSample, SampleStatus } from '@/types';
import { SampleActionModal } from './SampleActionModal';

export const PhlebotomyWorklistPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Action modal state
  const [selectedSample, setSelectedSample] = useState<SpecimenSample | null>(null);
  const [actionType, setActionType] = useState<'collect' | 'receive' | 'reject' | null>(null);

  const { data: samples = [], isLoading } = useQuery<SpecimenSample[]>({
    queryKey: ['samples', statusFilter, searchQuery],
    queryFn: () =>
      sampleService.getSamples({
        status: statusFilter === 'ALL' ? undefined : (statusFilter as SampleStatus),
        search: searchQuery || undefined,
      }),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['samples'] });
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  };

  const openAction = (sample: SpecimenSample, action: 'collect' | 'receive' | 'reject') => {
    setSelectedSample(sample);
    setActionType(action);
  };

  const getStatusBadge = (st: SampleStatus) => {
    switch (st) {
      case 'REGISTERED':
        return <Badge variant="low">Awaiting Collection</Badge>;
      case 'COLLECTED':
        return <Badge variant="brand">Collected / In Transit</Badge>;
      case 'RECEIVED':
        return <Badge variant="teal">Received in Lab</Badge>;
      case 'PROCESSING':
        return <Badge variant="normal">Processing</Badge>;
      case 'COMPLETED':
        return <Badge variant="normal">Completed</Badge>;
      case 'REJECTED':
        return <Badge variant="high">Rejected</Badge>;
      default:
        return <Badge variant="slate">{st}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Pipette className="w-7 h-7 text-brand-600" />
            Phlebotomy & Specimen Accessioning
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track biological specimens from collection, barcode labeling, lab reception, to rejection protocols.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Specimen ID (e.g. SMP-2026-000001) or barcode..."
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
            <option value="ALL">All Specimen States</option>
            <option value="REGISTERED">Registered (Pending Draw)</option>
            <option value="COLLECTED">Collected (In Transit)</option>
            <option value="RECEIVED">Received in Lab</option>
            <option value="PROCESSING">Processing</option>
            <option value="REJECTED">Rejected</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* Samples Table */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : samples.length === 0 ? (
        <Card className="py-12 text-center text-slate-500">
          <Pipette className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700">No specimen records found</p>
          <p className="text-xs text-slate-400 mt-1">Create bookings to accession required specimens</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Sample ID</th>
                  <th className="px-4 py-3 text-left">Specimen Type</th>
                  <th className="px-4 py-3 text-left">Container</th>
                  <th className="px-4 py-3 text-left">Barcode Label</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Custody Timestamps</th>
                  <th className="px-4 py-3 text-right">Phlebotomy Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {samples.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-xs text-brand-700 whitespace-nowrap">
                      {s.sample_id_display}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                      {s.sample_type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap text-xs">
                      {s.sample_container || 'Standard Container'}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {s.barcode_value || '—'}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {getStatusBadge(s.status)}
                      {s.rejection_reason && (
                        <p className="text-[11px] text-rose-600 font-medium mt-1 truncate max-w-xs">
                          {s.rejection_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {s.collected_at ? (
                        <div>
                          Collected:{' '}
                          <span className="text-slate-700 font-medium">
                            {new Date(s.collected_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Pending draw</span>
                      )}
                      {s.received_at && (
                        <div>
                          Received:{' '}
                          <span className="text-teal-700 font-medium">
                            {new Date(s.received_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {s.status === 'REGISTERED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openAction(s, 'collect')}
                            className="text-xs py-1"
                          >
                            Collect Sample
                          </Button>
                        )}
                        {s.status === 'COLLECTED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => openAction(s, 'receive')}
                            className="text-xs py-1 bg-teal-600 hover:bg-teal-700"
                          >
                            Receive in Lab
                          </Button>
                        )}
                        {s.status !== 'REJECTED' && s.status !== 'COMPLETED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openAction(s, 'reject')}
                            className="text-xs py-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                          >
                            Reject
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal */}
      <SampleActionModal
        isOpen={!!selectedSample && !!actionType}
        onClose={() => {
          setSelectedSample(null);
          setActionType(null);
        }}
        onSuccess={handleRefresh}
        sample={selectedSample}
        actionType={actionType}
      />
    </div>
  );
};
