import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical,
  Search,
  CheckCircle2,
  XCircle,
  Sparkles,
  Edit2,
  Save,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Modal, Button, Badge, LoadingSpinner, Alert } from '@/components/ui';
import { adminApi } from '@/api/adminService';
import { testService } from '@/api/testService';
import { LabTestAssignmentItem, TestCategory, DiagnosticTest } from '@/types';
import { EditTestModal } from '@/features/tests/EditTestModal';


export interface ManageLabTestsModalProps {
  labId: string | null;
  labName?: string;
  labCode?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ManageLabTestsModal: React.FC<ManageLabTestsModalProps> = ({
  labId,
  labName,
  labCode,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [filterTab, setFilterTab] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL');
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [editingPriceTestId, setEditingPriceTestId] = useState<string | null>(null);
  const [customPriceInput, setCustomPriceInput] = useState<string>('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Master Test state
  const [editingMasterTest, setEditingMasterTest] = useState<DiagnosticTest | null>(null);

  // Fetch Categories
  const { data: categories = [] } = useQuery<TestCategory[]>({
    queryKey: ['test-categories'],
    queryFn: () => testService.getCategories(),
    enabled: isOpen,
  });

  // Fetch Lab Assigned Tests
  const {
    data: testItems = [],
    isLoading,
  } = useQuery<LabTestAssignmentItem[]>({
    queryKey: ['adminLabTests', labId],
    queryFn: () => (labId ? adminApi.getLaboratoryTests(labId) : []),
    enabled: isOpen && !!labId,
  });

  // Assign Tests Mutation
  const assignMutation = useMutation({
    mutationFn: (testIds: string[]) =>
      adminApi.assignTestsToLaboratory(labId!, testIds),
    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ['adminLabTests', labId] });
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      setSelectedTestIds([]);
      setFeedbackMessage({
        type: 'success',
        text: 'Tests successfully assigned to this laboratory.',
      });
    },
    onError: (err: any) => {
      setFeedbackMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to assign tests.',
      });
    },
  });

  // Unassign Tests Mutation
  const unassignMutation = useMutation({
    mutationFn: (testIds: string[]) =>
      adminApi.unassignTestsFromLaboratory(labId!, testIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLabTests', labId] });
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      setSelectedTestIds([]);
      setFeedbackMessage({
        type: 'success',
        text: 'Tests unassigned from this laboratory.',
      });
    },
    onError: (err: any) => {
      setFeedbackMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to unassign tests.',
      });
    },
  });

  // Assign Common Tests Mutation
  const assignCommonMutation = useMutation({
    mutationFn: () => adminApi.assignCommonTestsToLaboratory(labId!),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['adminLabTests', labId] });
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      setFeedbackMessage({
        type: 'success',
        text: data?.newly_assigned
          ? `Successfully assigned ${data.newly_assigned} core common tests to this laboratory!`
          : 'All core common tests are already assigned to this laboratory.',
      });
    },
    onError: (err: any) => {
      setFeedbackMessage({
        type: 'error',
        text: err?.response?.data?.message || 'Failed to assign common tests.',
      });
    },
  });

  // Update Custom Price Mutation
  const updatePriceMutation = useMutation({
    mutationFn: ({ testId, customPrice }: { testId: string; customPrice: number }) =>
      adminApi.updateLaboratoryTestAssignment(labId!, testId, { custom_price: customPrice }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminLabTests', labId] });
      queryClient.invalidateQueries({ queryKey: ['tests'] });
      setEditingPriceTestId(null);
      setCustomPriceInput('');
      setFeedbackMessage({
        type: 'success',
        text: 'Custom test price updated for this laboratory.',
      });
    },
  });

  // Filtered Tests
  const filteredTests = useMemo(() => {
    return testItems.filter((item) => {
      if (filterTab === 'ASSIGNED' && !item.is_assigned) return false;
      if (filterTab === 'UNASSIGNED' && item.is_assigned) return false;
      if (selectedCategory !== 'ALL' && item.category_id !== selectedCategory) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchCode = item.code.toLowerCase().includes(term);
        const matchName = item.name.toLowerCase().includes(term);
        const matchShort = item.short_name?.toLowerCase().includes(term);
        if (!matchCode && !matchName && !matchShort) return false;
      }
      return true;
    });
  }, [testItems, filterTab, selectedCategory, searchTerm]);

  const assignedCount = testItems.filter((t) => t.is_assigned).length;
  const commonAssignedCount = testItems.filter((t) => t.is_assigned && t.is_common).length;
  const totalCommonCount = testItems.filter((t) => t.is_common).length;

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredTests.map((t) => t.test_id);
    const areAllSelected = allFilteredIds.every((id) => selectedTestIds.includes(id));
    if (areAllSelected) {
      setSelectedTestIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedTestIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleToggleSelect = (testId: string) => {
    setSelectedTestIds((prev) =>
      prev.includes(testId) ? prev.filter((id) => id !== testId) : [...prev, testId]
    );
  };

  const handleOpenMasterEdit = async (testId: string) => {
    try {
      const fullTest = await testService.getTestById(testId);
      setEditingMasterTest(fullTest);
    } catch (err) {
      console.error('Failed to load test details for editing', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Assign & Manage Diagnostic Tests — ${labName || 'Laboratory'}`}
        description={`Tenant: ${labCode || ''} | Configure tests available for billing, booking, and processing.`}
        maxWidth="2xl"
      >

        <div className="space-y-4">
          {/* Feedback Alert */}
          {feedbackMessage && (
            <Alert
              type={feedbackMessage.type === 'success' ? 'success' : 'error'}
              className="py-2.5 text-xs flex items-center justify-between"
            >
              <span>{feedbackMessage.text}</span>
              <button
                onClick={() => setFeedbackMessage(null)}
                className="text-xs font-bold underline ml-2"
              >
                Dismiss
              </button>
            </Alert>
          )}

          {/* Stats & Quick Actions Ribbon */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Assigned Tests
                </p>
                <p className="text-lg font-black text-slate-900">
                  {assignedCount}{' '}
                  <span className="text-xs font-medium text-slate-500">/ {testItems.length} total</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Default Core Tests
                </p>
                <p className="text-lg font-black text-emerald-700">
                  {commonAssignedCount}{' '}
                  <span className="text-xs font-medium text-slate-500">
                    / {totalCommonCount} Active
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button
                variant="primary"
                size="sm"
                onClick={() => assignCommonMutation.mutate()}
                isLoading={assignCommonMutation.isPending}
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                className="text-xs shadow-sm bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700"
              >
                Assign Default Common Tests
              </Button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search tests by name, code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs rounded-lg border border-slate-300 py-2 px-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>

              {/* Status Filter Tabs */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                {(['ALL', 'ASSIGNED', 'UNASSIGNED'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                      filterTab === tab
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab === 'ALL'
                      ? `All (${testItems.length})`
                      : tab === 'ASSIGNED'
                      ? `Assigned (${assignedCount})`
                      : `Unassigned (${testItems.length - assignedCount})`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bulk Selection Actions Bar */}
          {selectedTestIds.length > 0 && (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-lg text-xs animate-in fade-in">
              <span className="font-semibold text-indigo-900">
                {selectedTestIds.length} test{selectedTestIds.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => assignMutation.mutate(selectedTestIds)}
                  isLoading={assignMutation.isPending}
                  className="text-xs h-7 px-3 bg-emerald-600 hover:bg-emerald-700"
                >
                  Assign to Lab
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => unassignMutation.mutate(selectedTestIds)}
                  isLoading={unassignMutation.isPending}
                  className="text-xs h-7 px-3 text-rose-600 border-rose-300 hover:bg-rose-50"
                >
                  Unassign from Lab
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedTestIds([])}
                  className="text-xs h-7 px-2.5 text-slate-600"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Tests Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
            {isLoading ? (
              <div className="p-12 flex justify-center">
                <LoadingSpinner size="md" label="Loading test catalog..." />
              </div>
            ) : filteredTests.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No tests match the specified search or filter criteria.
              </div>
            ) : (
              <table className="w-full text-left text-xs divide-y divide-slate-100">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <button
                        onClick={handleSelectAllFiltered}
                        className="text-slate-400 hover:text-slate-600 focus:outline-none"
                        title="Select All Filtered"
                      >
                        {filteredTests.length > 0 &&
                        filteredTests.every((t) => selectedTestIds.includes(t.test_id)) ? (
                          <CheckSquare className="w-4 h-4 text-brand-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-2.5 px-3">Test Code & Name</th>
                    <th className="py-2.5 px-3">Department & Specimen</th>
                    <th className="py-2.5 px-3 text-right">Master Price</th>
                    <th className="py-2.5 px-3 text-right">Lab Custom Price</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredTests.map((test) => {
                    const isSelected = selectedTestIds.includes(test.test_id);
                    const isEditingPrice = editingPriceTestId === test.test_id;

                    return (
                      <tr
                        key={test.test_id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelected ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-2.5 px-3">
                          <button
                            onClick={() => handleToggleSelect(test.test_id)}
                            className="text-slate-400 hover:text-brand-600 focus:outline-none"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-brand-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* Code & Name */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-800 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                              {test.code}
                            </span>
                            {test.is_common && (
                              <Badge variant="brand" className="text-[9px] px-1.5 py-0">
                                Core Common
                              </Badge>
                            )}
                          </div>
                          <p className="font-semibold text-slate-900 mt-0.5 text-xs">
                            {test.name}
                          </p>
                        </td>

                        {/* Department & Specimen */}
                        <td className="py-2.5 px-3">
                          <p className="text-slate-600 font-medium">
                            {test.category_name || test.test_type}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {test.sample_type.replace(/_/g, ' ')}
                            {test.sample_container ? ` • ${test.sample_container}` : ''}
                          </p>
                        </td>

                        {/* Master Default Price */}
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          ₹{Number(test.default_price).toFixed(2)}
                        </td>

                        {/* Lab Custom Price */}
                        <td className="py-2.5 px-3 text-right">
                          {isEditingPrice ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-slate-400">₹</span>
                              <input
                                type="number"
                                step="any"
                                value={customPriceInput}
                                onChange={(e) => setCustomPriceInput(e.target.value)}
                                className="w-20 px-1.5 py-0.5 border border-brand-500 rounded text-xs text-right focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() =>
                                  updatePriceMutation.mutate({
                                    testId: test.test_id,
                                    customPrice: Number(customPriceInput),
                                  })
                                }
                                className="p-1 rounded bg-brand-600 text-white hover:bg-brand-700"
                                title="Save Custom Price"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingPriceTestId(null)}
                                className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                                title="Cancel"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <span
                                className={`font-semibold ${
                                  test.custom_price != null
                                    ? 'text-brand-700'
                                    : 'text-slate-400 italic'
                                }`}
                              >
                                {test.custom_price != null
                                  ? `₹${Number(test.custom_price).toFixed(2)}`
                                  : 'Default'}
                              </span>
                              {test.is_assigned && (
                                <button
                                  onClick={() => {
                                    setEditingPriceTestId(test.test_id);
                                    setCustomPriceInput(
                                      test.custom_price != null
                                        ? String(test.custom_price)
                                        : String(test.default_price)
                                    );
                                  }}
                                  className="text-slate-400 hover:text-brand-600 p-0.5"
                                  title="Edit Lab Price Override"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Assignment Status Badge */}
                        <td className="py-2.5 px-3 text-center">
                          {test.is_assigned ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Assigned
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                              Not Assigned
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Toggle Assignment Button */}
                            {test.is_assigned ? (
                              <button
                                onClick={() => unassignMutation.mutate([test.test_id])}
                                className="px-2 py-1 text-[11px] font-semibold rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors"
                              >
                                Unassign
                              </button>
                            ) : (
                              <button
                                onClick={() => assignMutation.mutate([test.test_id])}
                                className="px-2 py-1 text-[11px] font-semibold rounded bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 transition-colors"
                              >
                                Assign
                              </button>
                            )}

                            {/* Edit Master Test button (in case of mistake) */}
                            <button
                              onClick={() => handleOpenMasterEdit(test.test_id)}
                              className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Edit Test Details (Correct mistakes in name, price, sample, etc.)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              Showing {filteredTests.length} diagnostic tests
            </span>
            <Button variant="primary" onClick={onClose} size="sm">
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Master Test Modal (If any mistake in test catalog) */}
      <EditTestModal
        isOpen={!!editingMasterTest}
        onClose={() => setEditingMasterTest(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['adminLabTests', labId] });
          queryClient.invalidateQueries({ queryKey: ['tests'] });
          setEditingMasterTest(null);
          setFeedbackMessage({
            type: 'success',
            text: 'Master diagnostic test details updated successfully.',
          });
        }}
        test={editingMasterTest}
        categories={categories}
      />
    </>
  );
};
