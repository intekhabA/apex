import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TestTubes,
  Search,
  Filter,
  Plus,
  Tag,
  Clock,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, Button, Badge } from '@/components/ui';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { usePermissions } from '@/hooks/usePermissions';
import { testService } from '@/api/testService';
import { DiagnosticTest, TestCategory, TestPackage } from '@/types';
import { AddTestModal } from './AddTestModal';
import { AddCategoryModal } from './AddCategoryModal';
import { PricingOverrideModal } from './PricingOverrideModal';
import { AddPackageModal } from './AddPackageModal';

export const TestCatalogPage: React.FC = () => {
  const { isSuperAdmin, isLabAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'tests' | 'packages'>('tests');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

  // Modals state
  const [isAddTestOpen, setIsAddTestOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isAddPackageOpen, setIsAddPackageOpen] = useState(false);
  const [pricingTest, setPricingTest] = useState<DiagnosticTest | null>(null);

  // Fetch Categories
  const { data: categories = [] } = useQuery<TestCategory[]>({
    queryKey: ['test-categories'],
    queryFn: () => testService.getCategories(),
  });

  // Fetch Tests
  const {
    data: tests = [],
    isLoading: isTestsLoading,
  } = useQuery<DiagnosticTest[]>({
    queryKey: ['tests', selectedCategory, searchQuery],
    queryFn: () =>
      testService.getTests({
        category_id: selectedCategory === 'ALL' ? undefined : selectedCategory,
        search: searchQuery || undefined,
      }),
  });

  // Fetch Packages
  const { data: packages = [], isLoading: isPackagesLoading } = useQuery<TestPackage[]>({
    queryKey: ['test-packages'],
    queryFn: () => testService.getPackages(),
  });

  const toggleExpand = (id: string) => {
    setExpandedTestId((prev) => (prev === id ? null : id));
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tests'] });
    queryClient.invalidateQueries({ queryKey: ['test-packages'] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <TestTubes className="w-7 h-7 text-brand-600" />
            {isSuperAdmin ? 'Master Diagnostic Test Catalog' : 'Test Catalog & Dynamic Pricing'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isSuperAdmin
              ? 'Manage standardized diagnostic tests, reference ranges, and test profiles across all labs.'
              : 'View diagnostic tests, biological reference intervals, and configure laboratory-specific prices.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsAddCategoryOpen(true)}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Category
              </Button>
              <Button
                variant="primary"
                onClick={() => setIsAddTestOpen(true)}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Diagnostic Test
              </Button>
            </>
          )}

          {isLabAdmin && (
            <Button
              variant="primary"
              onClick={() => setIsAddPackageOpen(true)}
              className="flex items-center gap-1.5 shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              Build Test Bundle
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('tests')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'tests'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TestTubes className="w-4 h-4" />
          Individual Diagnostic Tests ({tests.length})
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={`px-4 py-2.5 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'packages'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Health Bundles & Packages ({packages.length})
        </button>
      </div>

      {activeTab === 'tests' ? (
        <>
          {/* Filters & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search tests by name, code, or short name (e.g. CBC, Bilirubin)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tests List */}
          {isTestsLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : tests.length === 0 ? (
            <Card className="py-12 text-center text-slate-500">
              <TestTubes className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No diagnostic tests found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or filter</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {tests.map((test) => {
                const isExpanded = expandedTestId === test.id;
                const hasCustomPrice =
                  test.effective_price !== undefined &&
                  test.effective_price !== null &&
                  Number(test.effective_price) !== Number(test.default_price);

                return (
                  <Card key={test.id} className="p-4 hover:border-slate-300 transition-shadow">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                            {test.code}
                          </span>
                          <h3 className="font-bold text-slate-900 text-base">{test.name}</h3>
                          <Badge variant="brand">{test.test_type}</Badge>
                          {test.category_name && (
                            <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                              {test.category_name}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                          <span className="flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            Sample: {test.sample_type.replace(/_/g, ' ')}
                            {test.sample_container ? ` (${test.sample_container})` : ''}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            Turnaround: {test.turnaround_hours}h
                          </span>
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                            Analytes: {test.parameters?.length || 0}
                          </span>
                        </div>
                      </div>

                      {/* Pricing & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                        <div className="text-right">
                          <div className="flex items-baseline gap-1.5 justify-end">
                            <span className="text-lg font-bold text-slate-900">
                              ₹{Number(test.effective_price ?? test.default_price).toFixed(2)}
                            </span>
                            {hasCustomPrice && (
                              <span className="text-xs text-slate-400 line-through">
                                ₹{Number(test.default_price).toFixed(2)}
                              </span>
                            )}
                          </div>
                          {hasCustomPrice && (
                            <Badge variant="low" className="text-[10px]">
                              Lab Custom Price
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {isLabAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPricingTest(test)}
                              className="text-xs"
                            >
                              Set Price
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleExpand(test.id)}
                            className="p-1.5"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-slate-600" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-600" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Parameters & Reference Ranges Table */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        {test.preparation_instructions && (
                          <div className="mb-3 text-xs bg-amber-50 text-amber-900 p-2.5 rounded-lg border border-amber-200">
                            <strong>Patient Instructions:</strong> {test.preparation_instructions}
                          </div>
                        )}

                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                          Sub-Parameters & Biological Reference Intervals
                        </h4>

                        {test.parameters?.length > 0 ? (
                          <div className="border border-slate-200 rounded-lg overflow-x-auto">
                            <table className="min-w-full text-xs divide-y divide-slate-200">
                              <thead className="bg-slate-50 text-slate-600 font-semibold">
                                <tr>
                                  <th className="px-3 py-2 text-left">Code</th>
                                  <th className="px-3 py-2 text-left">Parameter Name</th>
                                  <th className="px-3 py-2 text-left">Unit</th>
                                  <th className="px-3 py-2 text-left">Type</th>
                                  <th className="px-3 py-2 text-left">Biological Reference Interval</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {test.parameters.map((param) => (
                                  <tr key={param.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 font-mono font-medium text-slate-700">
                                      {param.code}
                                    </td>
                                    <td className="px-3 py-2 font-semibold text-slate-900">
                                      {param.name}
                                    </td>
                                    <td className="px-3 py-2 text-slate-600">{param.unit || '—'}</td>
                                    <td className="px-3 py-2 text-slate-500">{param.result_type}</td>
                                    <td className="px-3 py-2 text-slate-700">
                                      {param.reference_ranges?.length > 0 ? (
                                        <div className="space-y-1">
                                          {param.reference_ranges.map((rr, idx) => (
                                            <div key={idx} className="flex items-center gap-1.5">
                                              {rr.gender && (
                                                <span className="font-semibold text-slate-500 uppercase text-[10px]">
                                                  [{rr.gender}]:
                                                </span>
                                              )}
                                              <span>{rr.display_range_string}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400">Not specified</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">
                            No discrete sub-parameters configured for this test.
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* Diagnostic Bundles & Packages Tab */
        <div>
          {isPackagesLoading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : packages.length === 0 ? (
            <Card className="py-12 text-center text-slate-500">
              <Sparkles className="w-12 h-12 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No test bundles created yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Create comprehensive health checkup packages bundled with multiple tests
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packages.map((pkg) => (
                <Card key={pkg.id} className="p-5 flex flex-col justify-between hover:shadow-md transition">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-mono font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                          {pkg.code}
                        </span>
                        <h3 className="font-bold text-slate-900 text-lg mt-1">{pkg.name}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-bold text-slate-900">
                          ₹{Number(pkg.price).toFixed(2)}
                        </span>
                        {pkg.discount_percentage > 0 && (
                          <Badge variant="normal" className="block text-[10px] mt-0.5">
                            {pkg.discount_percentage}% OFF
                          </Badge>
                        )}
                      </div>
                    </div>

                    {pkg.description && (
                      <p className="text-xs text-slate-600">{pkg.description}</p>
                    )}

                    <div className="pt-3 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Included Tests ({pkg.items?.length || 0})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {pkg.items?.map((it, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded font-medium border border-slate-200"
                          >
                            {it.test_name || it.test_code || 'Test'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {isSuperAdmin && (
        <>
          <AddCategoryModal
            isOpen={isAddCategoryOpen}
            onClose={() => setIsAddCategoryOpen(false)}
            onSuccess={handleRefresh}
          />
          <AddTestModal
            isOpen={isAddTestOpen}
            onClose={() => setIsAddTestOpen(false)}
            onSuccess={handleRefresh}
            categories={categories}
          />
        </>
      )}

      <PricingOverrideModal
        isOpen={!!pricingTest}
        onClose={() => setPricingTest(null)}
        onSuccess={handleRefresh}
        test={pricingTest}
      />

      <AddPackageModal
        isOpen={isAddPackageOpen}
        onClose={() => setIsAddPackageOpen(false)}
        onSuccess={handleRefresh}
        availableTests={tests}
      />
    </div>
  );
};
