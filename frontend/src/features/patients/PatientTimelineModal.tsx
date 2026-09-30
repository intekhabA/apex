import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { Modal } from '@/components/ui';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { patientService } from '@/api/patientService';
import { Patient, TimelineEvent } from '@/types';

export interface PatientTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient | null;
}

export const PatientTimelineModal: React.FC<PatientTimelineModalProps> = ({
  isOpen,
  onClose,
  patient,
}) => {
  const { data: timeline = [], isLoading } = useQuery<TimelineEvent[]>({
    queryKey: ['patient-timeline', patient?.id],
    queryFn: () => (patient ? patientService.getPatientTimeline(patient.id) : Promise.resolve([])),
    enabled: !!patient && isOpen,
  });

  if (!patient) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Medical Timeline: ${patient.full_name} (${patient.patient_id_display})`}
      maxWidth="md"
    >
      <div className="max-h-[70vh] overflow-y-auto px-1 py-2">
        {isLoading ? (
          <div className="py-8 flex justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : timeline.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-6">No historical events recorded.</p>
        ) : (
          <div className="relative pl-6 border-l-2 border-brand-200 space-y-6">
            {timeline.map((event, idx) => (
              <div key={idx} className="relative">
                {/* Dot */}
                <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-brand-600 border-2 border-white shadow-sm flex items-center justify-center" />
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span className="font-semibold text-slate-600 uppercase tracking-wider">
                      {event.event_type.replace(/_/g, ' ')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">{event.title}</h4>
                  <p className="text-xs text-slate-600 mt-0.5">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};
