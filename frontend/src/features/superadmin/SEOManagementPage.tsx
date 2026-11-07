import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Globe,
  Search,
  Share2,
  Sparkles,
  Bot,
  FileCode2,
  Save,
  ExternalLink,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { seoApi } from '@/api/seoService';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, LoadingSpinner, toast } from '@/components/ui';
import { PlatformSEOSettingsUpdatePayload } from '@/types';

type TabType = 'web' | 'social' | 'ai' | 'robots';

export const SEOManagementPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('web');

  const { data: seoData, isLoading } = useQuery({
    queryKey: ['adminSEOSettings'],
    queryFn: seoApi.getAdminSEO,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
  } = useForm<PlatformSEOSettingsUpdatePayload>();

  const watchedTitle = watch('meta_title') || seoData?.meta_title || '';
  const watchedDesc = watch('meta_description') || seoData?.meta_description || '';
  const watchedCanonical = watch('canonical_url') || seoData?.canonical_url || 'https://trustmylab.in';
  const watchedOgTitle = watch('og_title') || seoData?.og_title || watchedTitle;
  const watchedOgDesc = watch('og_description') || seoData?.og_description || watchedDesc;
  const watchedOgImage = watch('og_image_url') || seoData?.og_image_url || 'https://trustmylab.in/og-image.png';

  useEffect(() => {
    if (seoData) {
      reset({
        meta_title: seoData.meta_title,
        meta_description: seoData.meta_description,
        meta_keywords: seoData.meta_keywords,
        canonical_url: seoData.canonical_url,
        og_title: seoData.og_title,
        og_description: seoData.og_description,
        og_image_url: seoData.og_image_url || '',
        google_site_verification: seoData.google_site_verification || '',
        bing_site_verification: seoData.bing_site_verification || '',
        enable_ai_search_indexing: seoData.enable_ai_search_indexing ?? true,
        ai_knowledge_brief: seoData.ai_knowledge_brief || '',
        custom_schema_json: seoData.custom_schema_json || '',
        robots_txt_content: seoData.robots_txt_content || '',
      });
    }
  }, [seoData, reset]);

  const updateMutation = useMutation({
    mutationFn: (payload: PlatformSEOSettingsUpdatePayload) => seoApi.updateAdminSEO(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['adminSEOSettings'], updated);
      queryClient.invalidateQueries({ queryKey: ['publicSEO'] });
      toast.success('Platform SEO & Search Optimization settings saved successfully.');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update SEO settings.');
    },
  });

  const onSubmit = (formData: PlatformSEOSettingsUpdatePayload) => {
    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return <LoadingSpinner size="lg" label="Loading platform SEO configuration..." />;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Globe className="w-7 h-7 text-brand-600" />
            SEO &amp; AI Search Engine Optimization
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure Google/Bing metadata, Open Graph social share cards, and AI Search (Perplexity, ChatGPT, Claude) parameters.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="primary"
            onClick={handleSubmit(onSubmit)}
            isLoading={updateMutation.isPending}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save All Settings
          </Button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {[
          { id: 'web', label: 'Web Search & SERP', icon: Search },
          { id: 'social', label: 'Social & Open Graph', icon: Share2 },
          { id: 'ai', label: 'AI Search & AEO (LLMs)', icon: Sparkles },
          { id: 'robots', label: 'Robots & Sitemap', icon: FileCode2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* TAB 1: WEB SEARCH & SERP */}
        {activeTab === 'web' && (
          <div className="space-y-6">
            {/* Live Google Search Card Preview */}
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-brand-600" />
                  Live Google Search Result Preview (Desktop SERP)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs max-w-2xl font-sans">
                  <div className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                    <div className="w-4 h-4 rounded-full bg-brand-600 text-white flex items-center justify-center text-[9px] font-bold">
                      T
                    </div>
                    <span className="font-medium text-slate-800">TrustMyLab</span>
                    <span className="text-slate-400">›</span>
                    <span className="text-slate-500 truncate">{watchedCanonical}</span>
                  </div>
                  <h3 className="text-lg font-medium text-[#1a0dab] hover:underline cursor-pointer leading-snug">
                    {watchedTitle || 'TrustMyLab — Multi-Tenant Diagnostic Laboratory Management System'}
                  </h3>
                  <p className="text-xs text-[#4d5156] mt-1 leading-relaxed line-clamp-2">
                    {watchedDesc ||
                      'Cloud-based diagnostic laboratory management system (LIMS) for pathology and radiology centers. Automate CBC/LFT/KFT calculations, QR-verified PDF reports, doctor commissions, and billing.'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Inputs */}
            <Card>
              <CardHeader>
                <CardTitle>Search Engine Core Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Primary Page Title (Meta Title)</label>
                    <span className={`text-[11px] font-semibold ${watchedTitle.length > 60 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {watchedTitle.length} / 60 characters
                    </span>
                  </div>
                  <Input
                    placeholder="TrustMyLab — Multi-Tenant Diagnostic Laboratory Management System (LIMS)"
                    {...register('meta_title')}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Recommended length: 50-60 characters for optimal display in Google SERP results.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Meta Description</label>
                    <span className={`text-[11px] font-semibold ${watchedDesc.length > 160 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {watchedDesc.length} / 160 characters
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-sans"
                    placeholder="Enter an outcome-driven summary for Google & AI search snippets..."
                    {...register('meta_description')}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Recommended length: 140-160 characters. Clearly convey value and primary features.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Canonical Base URL"
                    placeholder="https://trustmylab.in"
                    {...register('canonical_url')}
                  />
                  <Input
                    label="Meta Keywords (Comma Separated)"
                    placeholder="LIMS software, pathology lab software, diagnostic lab, CBC calculation"
                    {...register('meta_keywords')}
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Google Search Console Verification Token"
                    placeholder="google-site-verification=abc123xyz"
                    {...register('google_site_verification')}
                  />
                  <Input
                    label="Bing Webmaster Verification Token"
                    placeholder="msvalidate.01=abc123xyz"
                    {...register('bing_site_verification')}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: SOCIAL & OPEN GRAPH */}
        {activeTab === 'social' && (
          <div className="space-y-6">
            {/* Live Social Card Share Preview */}
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-brand-600" />
                  Live Social Media Card Preview (LinkedIn, WhatsApp, X, Facebook)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="max-w-md bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-md font-sans">
                  <div className="h-44 bg-gradient-to-br from-brand-900 to-slate-900 flex items-center justify-center relative overflow-hidden">
                    {watchedOgImage ? (
                      <img
                        src={watchedOgImage}
                        alt="Social preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-6 text-center">
                      <span className="text-white text-xl font-extrabold tracking-tight">TrustMyLab Healthcare</span>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TRUSTMYLAB.IN</span>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">{watchedOgTitle}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2">{watchedOgDesc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Open Graph &amp; Social Card Metadata</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Open Graph Title"
                  placeholder="TrustMyLab — Intelligent Diagnostic & Laboratory Management (LIMS)"
                  {...register('og_title')}
                />

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Open Graph Description</label>
                  <textarea
                    rows={3}
                    className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-sans"
                    placeholder="Enter social sharing description..."
                    {...register('og_description')}
                  />
                </div>

                <Input
                  label="Open Graph &amp; Twitter Image URL (1200x630 px recommended)"
                  placeholder="https://trustmylab.in/og-image.png"
                  {...register('og_image_url')}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3: AI SEARCH & AEO (LLMs) */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-brand-600" />
                  Answer Engine Optimization (AEO) &amp; Generative Engine Indexing (GEO)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* AI Indexing Toggle */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-brand-600" />
                      Allow AI Answer Engines (Perplexity, ChatGPT, Claude, Gemini) to Index &amp; Cite Platform
                    </span>
                    <p className="text-xs text-slate-500">
                      When enabled, your platform publishes AI-optimized directives (<code>/llms.txt</code>) permitting AI search engines to accurately cite your features, pricing, and clinical workflows.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      {...register('enable_ai_search_indexing')}
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                  </label>
                </div>

                {/* AI Knowledge Brief */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <FileCode2 className="w-4 h-4 text-brand-600" />
                      AI Knowledge &amp; Grounding Brief (Served in /llms.txt)
                    </label>
                    <a
                      href="/llms.txt"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                    >
                      View Live /llms.txt <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <textarea
                    rows={5}
                    className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                    placeholder="Enter an authoritative, fact-dense overview for AI models..."
                    {...register('ai_knowledge_brief')}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    This factual summary is ingested by AI crawlers when answer engines formulate answers for queries like &quot;What are the best LIMS platforms in India?&quot;
                  </p>
                </div>

                {/* Custom Schema.org JSON-LD Editor */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <FileCode2 className="w-4 h-4 text-teal-600" />
                      Custom Schema.org Structured Data (JSON-LD)
                    </label>
                    <span className="text-[11px] text-slate-400">Injected into document &lt;head&gt;</span>
                  </div>
                  <textarea
                    rows={5}
                    className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                    placeholder='{"@context": "https://schema.org", "@type": "MedicalBusiness", ...}'
                    {...register('custom_schema_json')}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Valid JSON-LD schema (e.g. MedicalBusiness, MedicalWebPage, AggregateOffer). Leave blank to use built-in standard schemas.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 4: ROBOTS & SITEMAP */}
        {activeTab === 'robots' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode2 className="w-5 h-5 text-brand-600" />
                  Crawler Directives &amp; Sitemap Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Active Sitemap Status */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">XML Sitemap Endpoint</span>
                    <code className="text-xs text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200 mt-1 inline-block">
                      https://trustmylab.in/sitemap.xml
                    </code>
                  </div>
                  <a
                    href="/sitemap.xml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 shadow-xs"
                  >
                    View Live Sitemap <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Robots.txt Editor */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">Robots.txt Content Override</label>
                    <a
                      href="/robots.txt"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                    >
                      View Live /robots.txt <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <textarea
                    rows={8}
                    className="w-full text-xs p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                    placeholder="User-agent: *&#10;Allow: /&#10;Disallow: /api/&#10;Disallow: /dashboard"
                    {...register('robots_txt_content')}
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Custom crawler directives. Leave blank to use the high-security system default allowing Googlebot, GPTBot, PerplexityBot, and ClaudeBot.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Floating / Sticky Save Bar */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span className="text-xs text-slate-600 font-medium">
              Changes apply instantly across public landing pages and crawler endpoints.
            </span>
          </div>

          <Button
            type="submit"
            variant="primary"
            isLoading={updateMutation.isPending}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save SEO Configuration
          </Button>
        </div>
      </form>
    </div>
  );
};
