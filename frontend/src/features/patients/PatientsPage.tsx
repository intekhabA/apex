import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Search, Plus, History } from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { patientService } from '@/api/patientService';
import { Patient } from '@/types';
import { AddPatientModal } from './AddPatientModal';
import { PatientTimelineModal } from './PatientTimelineModal';

export const PatientsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [selectedTimelinePatient, setSelectedTimelinePatient] = useState<Patient | null>(null);

  const { data: patients = [], isLoading } = useQuery<Patient[]>({
    queryKey: ['patients', searchQuery],
    queryFn: () => patientService.getPatients(searchQuery || undefined),
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['patients'] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-brand-600" />
            Patient Directory & Clinical Profiles
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Register patients, look up demographics, and inspect longitudinal diagnostic history.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsAddPatientOpen(true)}
          className="flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Register Patient
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
        <input
          type="text"
          placeholder="Search by patient name, mobile phone, or ID (e.g. PAT-2026-000001)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Patients Table */}
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : patients.length === 0 ? (
        <Card className="py-12 text-center text-slate-500">
          <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="font-semibold text-slate-700">No patient records found</p>
          <p className="text-xs text-slate-400 mt-1">Register a patient or refine your search</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Patient ID</th>
                  <th className="px-4 py-3 text-left">Full Name</th>
                  <th className="px-4 py-3 text-left">Gender / Age</th>
                  <th className="px-4 py-3 text-left">Contact Phone</th>
                  <th className="px-4 py-3 text-left">City</th>
                  <th className="px-4 py-3 text-left">Referring Doctor</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-xs text-brand-700 whitespace-nowrap">
                      {patient.patient_id_display}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                      {patient.full_name}
                      {patient.blood_group && (
                        <Badge variant="teal" className="ml-2 text-[10px]">
                          {patient.blood_group}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {patient.gender} • {patient.age_years}y
                      {patient.age_months > 0 ? ` ${patient.age_months}m` : ''}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-mono text-xs whitespace-nowrap">
                      {patient.phone}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                      {patient.city || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                      {patient.referring_doctor || 'Self / Walk-in'}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTimelinePatient(patient)}
                        className="text-xs flex items-center gap-1 ml-auto"
                      >
                        <History className="w-3.5 h-3.5" />
                        Timeline
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modals */}
      <AddPatientModal
        isOpen={isAddPatientOpen}
        onClose={() => setIsAddPatientOpen(false)}
        onSuccess={handleRefresh}
      />

      <PatientTimelineModal
        isOpen={!!selectedTimelinePatient}
        onClose={() => setSelectedTimelinePatient(null)}
        patient={selectedTimelinePatient}
      />
    </div>
  );
};
