import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ShieldCheck,
  Zap,
  CheckCircle2,
  FileCheck2,
  Users,
  Building2,
  Lock,
  QrCode,
  ArrowRight,
  Sparkles,
  ChevronDown,
  FlaskConical,
  ChevronRight,
  Smartphone,
  Award,
  Fingerprint,
  XCircle,
  HeartPulse
} from 'lucide-react';
import { useSEO } from '@/hooks/useSEO';
import { DnaBackground3D } from '@/components/common/DnaBackground3D';

interface SimulatorParam {
  name: string;
  value: string;
  unit: string;
  refText: string;
  status: 'normal' | 'low' | 'high' | 'critical';
  pct: number;
}

export const HomePage: React.FC = () => {
  useSEO();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [activeWorkstationTab, setActiveWorkstationTab] = useState<'worklist' | 'flags' | 'qr_seal' | 'commissions'>('worklist');
  const [activeSimulator, setActiveSimulator] = useState<'cbc' | 'lipid' | 'lft' | 'thyroid'>('cbc');

  const simulatorPanels: Record<'cbc' | 'lipid' | 'lft' | 'thyroid', { title: string; subtitle: string; params: SimulatorParam[] }> = {
    cbc: {
      title: 'Complete Blood Count (CBC) with Differential',
      subtitle: 'Specimen: Whole Blood (EDTA Lavender) • Analyzed via 5-Part Cell Counter',
      params: [
        { name: 'Hemoglobin (Hb)', value: '10.2', unit: 'g/dL', refText: '12.0 – 15.5 g/dL (Adult Female)', status: 'low', pct: 28 },
        { name: 'Total Leukocyte Count (WBC)', value: '14,200', unit: '/µL', refText: '4,000 – 11,000 /µL', status: 'high', pct: 82 },
        { name: 'Platelet Count', value: '260,000', unit: '/µL', refText: '150,000 – 450,000 /µL', status: 'normal', pct: 54 },
        { name: 'Neutrophils', value: '78', unit: '%', refText: '40 – 75 %', status: 'high', pct: 80 },
      ],
    },
    lipid: {
      title: 'Comprehensive Lipid Profile',
      subtitle: 'Specimen: Serum (Gold SST Tube) • 12-Hour Fasting Calibrated',
      params: [
        { name: 'Total Cholesterol', value: '248', unit: 'mg/dL', refText: 'Desirable: < 200 mg/dL', status: 'high', pct: 84 },
        { name: 'Serum Triglycerides', value: '185', unit: 'mg/dL', refText: 'Normal: < 150 mg/dL', status: 'high', pct: 74 },
        { name: 'HDL (Good) Cholesterol', value: '54', unit: 'mg/dL', refText: 'Optimal: > 50 mg/dL (Female)', status: 'normal', pct: 62 },
        { name: 'LDL (Bad) Cholesterol', value: '157', unit: 'mg/dL', refText: 'Optimal: < 100 mg/dL', status: 'high', pct: 86 },
      ],
    },
    lft: {
      title: 'Liver Function Test (LFT)',
      subtitle: 'Specimen: Serum Clot Activator • Spectrophotometric Kinetics',
      params: [
        { name: 'Bilirubin Total', value: '0.85', unit: 'mg/dL', refText: '0.2 – 1.2 mg/dL', status: 'normal', pct: 45 },
        { name: 'SGPT / ALT', value: '84', unit: 'U/L', refText: 'Normal: 7 – 56 U/L', status: 'critical', pct: 90 },
        { name: 'SGOT / AST', value: '62', unit: 'U/L', refText: 'Normal: 10 – 40 U/L', status: 'high', pct: 78 },
        { name: 'Alkaline Phosphatase (ALP)', value: '105', unit: 'U/L', refText: '44 – 147 U/L', status: 'normal', pct: 52 },
      ],
    },
    thyroid: {
      title: 'Thyroid Function Panel (T3, T4, TSH)',
      subtitle: 'Specimen: Serum • Chemiluminescence Immunoassay (CLIA)',
      params: [
        { name: 'TSH (Thyroid Stimulating Hormone)', value: '6.85', unit: 'µIU/mL', refText: '0.40 – 4.50 µIU/mL', status: 'high', pct: 88 },
        { name: 'Free Thyroxine (FT4)', value: '1.18', unit: 'ng/dL', refText: '0.80 – 1.80 ng/dL', status: 'normal', pct: 48 },
        { name: 'Free Triiodothyronine (FT3)', value: '2.85', unit: 'pg/mL', refText: '2.00 – 4.40 pg/mL', status: 'normal', pct: 46 },
      ],
    },
  };

  const faqs = [
    {
      q: 'How fast can our laboratory get started with TrustMyLab?',
      a: 'You can launch your complete lab workstation in under 5 minutes. Our pre-configured clinical test catalogs (CBC, LFT, KFT, Thyroid, Lipid, Urine Examination) and built-in PDF letterhead templates allow you to start registering patients and printing reports immediately.',
    },
    {
      q: 'Is patient health data secure and ISO 15189 / HIPAA compliant?',
      a: 'Yes. TrustMyLab enforces strict multi-tenant isolation at the database layer. All data is encrypted in transit via TLS 1.3 and at rest with AES-256. Reports feature cryptographic HMAC SHA-256 signatures, making document tampering mathematically impossible.',
    },
    {
      q: 'Can we customize reports with our laboratory logo and digital signatures?',
      a: 'Yes. You can upload custom header and footer letterhead graphics, digital signatures for consulting pathologists and radiologists, custom color palettes, and specific biological reference ranges.',
    },
    {
      q: 'Does TrustMyLab support multi-branch collection center networks?',
      a: 'Yes. Our platform supports centralized processing where blood and specimen samples are collected at peripheral phlebotomy centers and transferred to the central hub for automated analysis and approval.',
    },
    {
      q: 'How does the automated referring doctor commission engine work?',
      a: 'You can configure percentage or fixed referral commission tiers per doctor or per test group. The system automatically tracks referring physicians, aggregates test revenues, and generates itemized payout statements with one click.',
    },
    {
      q: 'What happens when our 14-day free trial concludes?',
      a: 'You can choose between our Starter, Professional, or Enterprise subscription plans. All your patient records, test catalogs, custom reference matrices, and invoice records remain 100% safe and intact.',
    },
  ];

  return (
    <div className="space-y-24 lg:space-y-36 pb-28 font-sans selection:bg-brand-500 selection:text-white">
      {/* =========================================================================
          HERO SECTION WITH 3D DNA & TUMBLING BLOOD CELLS BACKGROUND
          ========================================================================= */}
      <section className="relative overflow-hidden pt-10 pb-20 lg:pt-20 lg:pb-32 bg-slate-950 text-white border-b border-slate-900">
        {/* 3D Moving DNA & Blood Cells Biological Background */}
        <DnaBackground3D opacity={0.88} speed={1.0} showBloodCells={true} />

        {/* Ambient Bioluminescent Lighting Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-brand-500/15 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-rose-500/10 rounded-full blur-[110px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Clinical Innovation Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-brand-300 text-xs font-semibold tracking-wide shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>Next Generation Multi-Tenant Clinical LIMS Software</span>
              <span className="bg-brand-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold">v2.4 Live</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.12] text-balance">
              Intelligent Diagnostic & Lab Management{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-brand-400 to-teal-300">
                Engineered for Clinical Precision
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed max-w-2xl mx-auto text-pretty">
              Streamline phlebotomy accessioning, automate biological reference flag calculations, issue tamper-proof QR medical reports, and track revenue from one unified workstation.
            </p>

            {/* Primary & Secondary Action CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl font-semibold text-base bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white shadow-xl shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>Start 14-Day Free Trial</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <Link
                to="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base bg-white/10 hover:bg-white/15 border border-white/20 text-white backdrop-blur-md transition-all active:scale-[0.98]"
              >
                <span>Explore Transparent Pricing</span>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </Link>
            </div>

            {/* Trust and Compliance Callouts */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> No Credit Card Required
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-brand-400" /> ISO 15189 & HIPAA Compliant
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-400" /> Cryptographic HMAC SHA-256 PDF Seal
              </span>
            </div>
          </div>

          {/* =========================================================================
              INTERACTIVE CLINICAL WORKSTATION PREVIEW (TABS)
              ========================================================================= */}
          <div className="mt-14 lg:mt-20 max-w-5xl mx-auto">
            <div className="relative rounded-2xl bg-slate-900/95 border border-slate-700/60 shadow-2xl backdrop-blur-2xl overflow-hidden ring-1 ring-white/10">
              {/* Window Header & Tabs Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-950/80 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs font-mono text-slate-400 hidden sm:inline">
                    trustmylab.in/workstation
                  </span>
                </div>

                {/* Interactive Workstation Modes */}
                <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs font-medium">
                  <button
                    onClick={() => setActiveWorkstationTab('worklist')}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      activeWorkstationTab === 'worklist'
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Phlebotomy Worklist
                  </button>
                  <button
                    onClick={() => setActiveWorkstationTab('flags')}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      activeWorkstationTab === 'flags'
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Auto Biological Flags
                  </button>
                  <button
                    onClick={() => setActiveWorkstationTab('qr_seal')}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      activeWorkstationTab === 'qr_seal'
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    HMAC QR Report
                  </button>
                  <button
                    onClick={() => setActiveWorkstationTab('commissions')}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      activeWorkstationTab === 'commissions'
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Doctor Commissions
                  </button>
                </div>
              </div>

              {/* Dynamic Tab Body */}
              <div className="p-6 text-left">
                {/* TAB 1: Phlebotomy Worklist */}
                {activeWorkstationTab === 'worklist' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div>
                        <h4 className="text-sm font-semibold text-white">Active Phlebotomy Queue</h4>
                        <p className="text-xs text-slate-400">Specimen barcoding and tube collection status</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        148 Samples Accessioned
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold">
                            <th className="py-2.5 px-3">Tube Barcode</th>
                            <th className="py-2.5 px-3">Patient Name</th>
                            <th className="py-2.5 px-3">Test Panel</th>
                            <th className="py-2.5 px-3">Vial Specimen</th>
                            <th className="py-2.5 px-3">Queue Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          <tr>
                            <td className="py-2.5 px-3 font-bold text-brand-400">#LAB-2026-9041</td>
                            <td className="py-2.5 px-3 font-sans text-slate-200">Meera Patel (34F)</td>
                            <td className="py-2.5 px-3 font-sans text-slate-300">Complete Blood Count (CBC)</td>
                            <td className="py-2.5 px-3 text-purple-300">EDTA Lavender</td>
                            <td className="py-2.5 px-3 font-sans">
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                In Analysis
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-bold text-brand-400">#LAB-2026-9042</td>
                            <td className="py-2.5 px-3 font-sans text-slate-200">Rajesh Verma (58M)</td>
                            <td className="py-2.5 px-3 font-sans text-slate-300">Lipid Profile & HbA1c</td>
                            <td className="py-2.5 px-3 text-amber-300">Serum Gold Gel</td>
                            <td className="py-2.5 px-3 font-sans">
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                Phlebotomy Pending
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td className="py-2.5 px-3 font-bold text-brand-400">#LAB-2026-9043</td>
                            <td className="py-2.5 px-3 font-sans text-slate-200">Sarah Jenkins (29F)</td>
                            <td className="py-2.5 px-3 font-sans text-slate-300">Thyroid Profile (T3, T4, TSH)</td>
                            <td className="py-2.5 px-3 text-rose-300">Clot Activator Red</td>
                            <td className="py-2.5 px-3 font-sans">
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                Ready for Approval
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 2: Auto Biological Flags */}
                {activeWorkstationTab === 'flags' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div>
                        <h4 className="text-sm font-semibold text-white">Intelligent Biological Range Matrix</h4>
                        <p className="text-xs text-slate-400">Automatic flagging calibrated to patient age and gender</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        Critical Panic Alerts Active
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Hemoglobin (Hb)</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            LOW FLAG
                          </span>
                        </div>
                        <div className="text-xl font-bold text-white font-mono">10.2 <span className="text-xs text-slate-400 font-sans">g/dL</span></div>
                        <div className="text-[11px] text-slate-400">Ref: 12.0 – 15.5 g/dL (Adult Female)</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-amber-400 h-full w-[35%]" />
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Fast Blood Sugar (FBS)</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            HIGH CRITICAL
                          </span>
                        </div>
                        <div className="text-xl font-bold text-rose-300 font-mono">168 <span className="text-xs text-slate-400 font-sans">mg/dL</span></div>
                        <div className="text-[11px] text-slate-400">Ref: 70 – 100 mg/dL (Normal)</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-rose-500 h-full w-[85%]" />
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Platelet Count</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            NORMAL
                          </span>
                        </div>
                        <div className="text-xl font-bold text-emerald-300 font-mono">245,000 <span className="text-xs text-slate-400 font-sans">/µL</span></div>
                        <div className="text-[11px] text-slate-400">Ref: 150,000 – 450,000 /µL</div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full w-[55%]" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: HMAC QR Report Seal */}
                {activeWorkstationTab === 'qr_seal' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div>
                        <h4 className="text-sm font-semibold text-white">Tamper-Proof Medical PDF Certificate</h4>
                        <p className="text-xs text-slate-400">Cryptographically verifiable by patients and referring clinics</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                        <Fingerprint className="w-3.5 h-3.5" /> Cryptographically Sealed
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row items-center gap-5">
                      <div className="w-20 h-20 bg-white rounded-xl p-2 flex items-center justify-center shrink-0 shadow-lg">
                        <QrCode className="w-full h-full text-slate-950" />
                      </div>
                      <div className="space-y-1.5 text-xs text-center sm:text-left">
                        <div className="font-semibold text-slate-200 text-sm">
                          Verified Pathology Approval Signature
                        </div>
                        <div className="text-slate-400 font-mono text-[11px] break-all">
                          SHA256: 8a7f49c0d12e6b98a3c4f7e2d19b8841029e71ab82c94317f...
                        </div>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-[11px] text-slate-300">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Doctor Digital Signature Appended
                          </span>
                          <span className="flex items-center gap-1 text-brand-300">
                            <Smartphone className="w-3.5 h-3.5" /> Direct WhatsApp Link Dispatched
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: Doctor Commissions */}
                {activeWorkstationTab === 'commissions' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div>
                        <h4 className="text-sm font-semibold text-white">Automated Referral Accounting</h4>
                        <p className="text-xs text-slate-400">Eliminate manual spreadsheets with automatic commission calculation</p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Monthly Payout Ledger
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                        <div className="text-slate-400">Dr. A. K. Banerjee (Consultant Physician)</div>
                        <div className="text-lg font-bold text-white font-mono">₹ 14,850 Payout</div>
                        <div className="text-[11px] text-emerald-400 font-sans">33 Referrals • 15% Standard Tier</div>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                        <div className="text-slate-400">Dr. Sunita Rao (Gynecologist)</div>
                        <div className="text-lg font-bold text-white font-mono">₹ 28,400 Payout</div>
                        <div className="text-[11px] text-emerald-400 font-sans">48 Referrals • Specialized Hormone Tier</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 1: EXECUTIVE TRUST BADGES & METRICS (IMMEDIATELY AFTER DNA HERO)
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-10 relative z-20">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/90 shadow-2xl shadow-slate-200/60 grid grid-cols-2 lg:grid-cols-4 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 text-brand-600 mb-1">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">500+</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Laboratories</div>
            <p className="text-xs text-slate-400">Across 18 healthcare territories</p>
          </div>
          <div className="text-center space-y-2 pt-6 lg:pt-0">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 text-teal-600 mb-1">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">10M+</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Certified Reports</div>
            <p className="text-xs text-slate-400">HMAC cryptographic anti-tamper</p>
          </div>
          <div className="text-center space-y-2 pt-6 lg:pt-0">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 mb-1">
              <Zap className="w-5 h-5" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">&lt; 1.2s</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">PDF Latency</div>
            <p className="text-xs text-slate-400">Instant vector print generation</p>
          </div>
          <div className="text-center space-y-2 pt-6 lg:pt-0">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 mb-1">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">99.99%</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Uptime Reliability</div>
            <p className="text-xs text-slate-400">Guaranteed enterprise SLA</p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: INTERACTIVE CLINICAL TEST SIMULATOR (FEATURE HIGHLIGHT)
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-brand-600 font-bold text-xs uppercase tracking-widest bg-brand-50 px-3.5 py-1.5 rounded-full border border-brand-200/60">
            Automated Clinical Intelligence
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
            Interactive Biological Flagging Simulator
          </h2>
          <p className="text-slate-600 text-base leading-relaxed text-pretty">
            See how TrustMyLab automatically detects abnormal values against patient age and gender reference matrices in real time. Click any panel below:
          </p>
        </div>

        {/* Panel Switcher Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
          {[
            { id: 'cbc', label: 'Complete Blood Count (CBC)', icon: FlaskConical },
            { id: 'lipid', label: 'Lipid Profile', icon: HeartPulse },
            { id: 'lft', label: 'Liver Function Test (LFT)', icon: Activity },
            { id: 'thyroid', label: 'Thyroid (T3, T4, TSH)', icon: Zap },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeSimulator === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSimulator(item.id as any)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Simulator Display Card */}
        <div className="bg-gradient-to-b from-white to-slate-50/80 rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xl max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200/80">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                {simulatorPanels[activeSimulator].title}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {simulatorPanels[activeSimulator].subtitle}
              </p>
            </div>
            <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Auto-Flagging Active
            </span>
          </div>

          <div className="space-y-4">
            {simulatorPanels[activeSimulator].params.map((param, idx) => {
              const isNormal = param.status === 'normal';
              const isLow = param.status === 'low';
              const isHigh = param.status === 'high';
              const isCritical = param.status === 'critical';

              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all space-y-2.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs sm:text-sm">
                    <span className="font-semibold text-slate-900">{param.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-base text-slate-900">
                        {param.value} <span className="text-xs text-slate-500 font-normal">{param.unit}</span>
                      </span>
                      {isNormal && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          NORMAL
                        </span>
                      )}
                      {isLow && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          &darr; LOW FLAG
                        </span>
                      )}
                      {isHigh && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          &uarr; HIGH FLAG
                        </span>
                      )}
                      {isCritical && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-600 text-white animate-pulse">
                          CRITICAL ALERT
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Biological Gradient Range Bar */}
                  <div className="space-y-1">
                    <div className="relative w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      {/* Normal Zone Indicator */}
                      <div className="absolute inset-y-0 left-[25%] right-[25%] bg-emerald-100/80 rounded-sm" />
                      {/* Marker */}
                      <div
                        className={`absolute top-0 bottom-0 w-3 rounded-full shadow-sm transition-all duration-500 ${
                          isNormal
                            ? 'bg-emerald-500 ring-2 ring-emerald-200'
                            : isLow
                            ? 'bg-amber-500 ring-2 ring-amber-200'
                            : 'bg-rose-500 ring-2 ring-rose-200'
                        }`}
                        style={{ left: `calc(${param.pct}% - 6px)` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Low Threshold</span>
                      <span className="font-medium text-slate-600">{param.refText}</span>
                      <span>High Threshold</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 3: MANDATORY TAGLINE REVEAL MOMENT
          ========================================================================= */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold uppercase tracking-wider">
          <Award className="w-3.5 h-3.5 text-brand-600" />
          The Modern Diagnostic Standard
        </div>

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 tracking-tight leading-[1.2] text-balance">
          The clinical operating system that transforms manual phlebotomy logs into certified medical intelligence in seconds.
        </h2>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed text-pretty">
          From accessioning at the phlebotomy chair to multi-specialist sign-off and instant patient WhatsApp delivery, every diagnostic step is verified and audit compliant.
        </p>
      </section>

      {/* =========================================================================
          SECTION 4: MODERN BENTO GRID FOR EVERY DIAGNOSTIC SCALE
          ========================================================================= */}
      <section id="solutions" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-brand-600 font-bold text-xs uppercase tracking-widest bg-brand-50 px-3.5 py-1.5 rounded-full border border-brand-200/60">
            Tailored For Clinical Institutions
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Engineered for Every Laboratory Scale
          </h2>
          <p className="text-slate-600 text-base">
            Whether you operate an independent clinic or a multi-city reference network, TrustMyLab scales with your patient volume.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bento Card 1: Pathology Labs (Spans 2 cols) */}
          <div className="lg:col-span-2 bg-gradient-to-br from-white to-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center shadow-xs">
                <FlaskConical className="w-6 h-6" />
              </div>
              <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                Core Pathology Engine
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">
                Automated Pathology & Clinical Biochemistry
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                Eliminate manual reference calculation errors. TrustMyLab automatically checks adult and pediatric age-gender matrices for Hematology, Serology, Hormones, and Urine chemistry.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200/70 text-xs">
              <div className="space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Pre-Built Catalogs
                </div>
                <p className="text-slate-500">Over 350+ validated diagnostic test panels ready to use.</p>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Panic Value Alerts
                </div>
                <p className="text-slate-500">Instant visual warnings for critical biological values.</p>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Barcode Printing
                </div>
                <p className="text-slate-500">Automated thermal barcode labels for specimen tubes.</p>
              </div>
            </div>
          </div>

          {/* Bento Card 2: Imaging & Radiology */}
          <div className="bg-gradient-to-br from-white to-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shadow-xs">
              <Activity className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">
                Imaging & Radiology Reports
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Structured clinical templates for Ultrasound, X-Ray, ECG, and CT reporting with specialized radiologist findings and DICOM attachments.
              </p>
            </div>

            <ul className="text-xs text-slate-600 space-y-2.5 pt-4 border-t border-slate-200/70">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Preset USG Abdomen & Pelvis impression templates</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>Radiologist digital sign-off with credential seals</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                <span>High-resolution image embed options</span>
              </li>
            </ul>
          </div>

          {/* Bento Card 3: Multi-Branch Chains */}
          <div className="bg-gradient-to-br from-white to-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">
                Multi-Branch Networks
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Connect remote collection centers to your central processing facility with real-time specimen tracking and logistics audit trails.
              </p>
            </div>

            <ul className="text-xs text-slate-600 space-y-2.5 pt-4 border-t border-slate-200/70">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Centralized administrative billing overview</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Inter-branch sample transfer logs</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Separate staff logins per location</span>
              </li>
            </ul>
          </div>

          {/* Bento Card 4: Doctor Commission & Patient Portal (Spans 2 cols) */}
          <div className="lg:col-span-2 bg-gradient-to-br from-white to-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
                <Users className="w-6 h-6" />
              </div>
              <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                Financial & Patient Portal Hub
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">
                Referring Doctor Accounting & Patient Portal
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed max-w-2xl">
                Automatically calculate referring physician commission splits without spreadsheet errors. Patients gain access to an online portal to review their historical diagnostic trends.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200/70 text-xs">
              <div className="space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-purple-600" /> Payout Statements
                </div>
                <p className="text-slate-500">1-click itemized commission statements for doctors.</p>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-purple-600" /> Patient Trend Charts
                </div>
                <p className="text-slate-500">Historical biomarker tracking (e.g. HbA1c over time).</p>
              </div>
              <div className="space-y-1">
                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-purple-600" /> WhatsApp Integration
                </div>
                <p className="text-slate-500">Instant PDF download link sent directly to mobile.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 5: 3-STEP CLINICAL TURNAROUND TIME PIPELINE
          ========================================================================= */}
      <section className="bg-slate-950 text-white py-24 border-y border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-teal-400 font-bold text-xs uppercase tracking-widest bg-teal-950/80 px-3.5 py-1.5 rounded-full border border-teal-800">
              Turnaround Time Optimization
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              From Phlebotomy to Verified Report in 3 Steps
            </h2>
            <p className="text-slate-400 text-base">
              Eliminate administrative bottlenecks with an automated, zero-error diagnostic workflow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="bg-slate-900/90 p-8 rounded-3xl border border-slate-800 space-y-5 relative shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center font-bold text-lg font-mono">
                01
              </div>
              <h3 className="text-xl font-bold text-white">Accession & Barcode Labeling</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Register patient booking, select diagnostic panels, and automatically print specimen tube barcode labels with test codes.
              </p>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300">
                <span className="text-brand-400">Barcode Assigned:</span> #TUBE-88219 (EDTA)
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-900/90 p-8 rounded-3xl border border-slate-800 space-y-5 relative shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold text-lg font-mono">
                02
              </div>
              <h3 className="text-xl font-bold text-white">Automated Range Flagging</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Enter test findings or import analyzer data. The engine auto-computes abnormal flags against clinical reference ranges.
              </p>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-amber-300">
                <span>Calculated Flag:</span> Hb 10.2 (Low - Female Matrix)
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-900/90 p-8 rounded-3xl border border-slate-800 space-y-5 relative shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold text-lg font-mono">
                03
              </div>
              <h3 className="text-xl font-bold text-white">Cryptographic QR Dispatch</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Pathologist authorizes report with digital signature. A tamper-proof PDF with instant HMAC verification QR is generated and dispatched.
              </p>
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Signed & Dispatched in 0.8s
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 6: BEFORE & AFTER COMPARISON (TRADITIONAL LIMS VS TRUSTMYLAB)
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-brand-600 font-bold text-xs uppercase tracking-widest bg-brand-50 px-3.5 py-1.5 rounded-full border border-brand-200/60">
            Why Laboratories Upgrade
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Traditional Manual LIMS vs TrustMyLab Cloud
          </h2>
          <p className="text-slate-600 text-base">
            See the transformative difference between legacy desktop software and our modern clinical cloud.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Traditional LIMS Card */}
          <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Traditional Legacy LIMS</h3>
                <p className="text-xs text-slate-500">Desktop-bound & manual spreadsheets</p>
              </div>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-slate-600">
              <li className="flex items-start gap-3">
                <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>Manual reference range lookup in books prone to human transcription errors</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>Static unverified PDFs vulnerable to Photoshop report tampering & forgery</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>Spreadsheet tracking for doctor commissions taking days of reconciliation</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>No patient portal; staff forced to manually email or print hard copies</span>
              </li>
              <li className="flex items-start gap-3">
                <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>Local server crashes risking total loss of patient medical records</span>
              </li>
            </ul>
          </div>

          {/* TrustMyLab Card */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-brand-900 via-brand-950 to-slate-900 text-white border border-brand-800 shadow-xl space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-brand-800/80">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">TrustMyLab Cloud Operating System</h3>
                <p className="text-xs text-brand-300">Intelligent, automated & cryptographically sealed</p>
              </div>
            </div>

            <ul className="space-y-4 text-xs sm:text-sm text-slate-200">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Automated age & gender biological reference matrix calculations with panic alerts</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Cryptographic HMAC SHA-256 digital seals with instant scannable public QR check</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>1-Click automated doctor referral commission ledgers & itemized payout statements</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Self-service patient portal with historical biomarker charts & instant WhatsApp dispatch</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Encrypted cloud backups with 99.99% uptime and ISO 15189 / HIPAA compliance</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 7: PRICING HIGHLIGHT BANNER
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-slate-950 text-white p-8 sm:p-12 overflow-hidden shadow-2xl border border-slate-800">
          <div className="absolute right-0 top-0 w-96 h-96 bg-brand-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-400/30">
                <Sparkles className="w-3.5 h-3.5" /> Predictable SaaS Subscription
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight text-balance">
                Simple Plans Tailored to Your Diagnostic Test Volume
              </h2>
              <p className="text-slate-300 text-base leading-relaxed text-pretty">
                No hidden setup fees, free data migration assistance from legacy software, and a 14-day free trial with no credit card required.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Link
                to="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base bg-white text-slate-950 hover:bg-slate-100 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Compare All Features & Pricing</span>
                <ArrowRight className="w-5 h-5 text-brand-600" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 8: VERIFIED PATHOLOGIST & CLINICAL TESTIMONIALS
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-brand-600 font-bold text-xs uppercase tracking-widest bg-brand-50 px-3.5 py-1.5 rounded-full border border-brand-200/60">
            Clinical Peer Reviews
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Trusted by Laboratory Directors
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Testimonial 1 */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex text-amber-400 gap-1 text-sm font-sans">★★★★★</div>
              <p className="text-slate-700 text-sm leading-relaxed">
                "TrustMyLab transformed our daily accessioning. The automatic biological flag calculations save our pathologists hours every day, and patients appreciate receiving verified WhatsApp report links."
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center text-xs">
                RS
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Dr. Rajesh Sharma</div>
                <div className="text-xs text-slate-500">Chief Pathologist, Apex Diagnostics</div>
              </div>
            </div>
          </div>

          {/* Testimonial 2 */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex text-amber-400 gap-1 text-sm font-sans">★★★★★</div>
              <p className="text-slate-700 text-sm leading-relaxed">
                "The HMAC QR code verification on PDF reports has eliminated sample report tampering completely. Referring hospitals and consulting doctors trust our reports without hesitation."
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs">
                MP
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Meera Patel</div>
                <div className="text-xs text-slate-500">Operations Director, Metro Clinical Care</div>
              </div>
            </div>
          </div>

          {/* Testimonial 3 */}
          <div className="bg-white p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex text-amber-400 gap-1 text-sm font-sans">★★★★★</div>
              <p className="text-slate-700 text-sm leading-relaxed">
                "Managing referring doctor commission rates used to take days every month. TrustMyLab computes commissions and exports itemized ledger statements in one click."
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-xs">
                AK
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Dr. Anil Kapoor</div>
                <div className="text-xs text-slate-500">Founder, LifeLine Reference Lab</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION 9: INTERACTIVE FAQ ACCORDION
          ========================================================================= */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <span className="text-brand-600 font-bold text-xs uppercase tracking-widest bg-brand-50 px-3.5 py-1.5 rounded-full border border-brand-200/60">
            Frequently Asked Questions
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Clear Answers to Common Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs transition-all"
            >
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full p-5 text-left flex items-center justify-between font-semibold text-slate-900 hover:text-brand-600 transition-colors focus:outline-none"
              >
                <span className="text-base">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${
                    openFaq === index ? 'rotate-180 text-brand-600' : ''
                  }`}
                />
              </button>

              {openFaq === index && (
                <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3 text-pretty">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* =========================================================================
          SECTION 10: CONVERSION CTA WITH RISK REVERSAL
          ========================================================================= */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-brand-600 via-brand-700 to-indigo-800 text-white p-8 sm:p-14 text-center space-y-6 shadow-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl mx-auto text-balance">
            Ready to Modernize Your Diagnostic Laboratory?
          </h2>
          <p className="text-brand-100 text-base max-w-xl mx-auto leading-relaxed text-pretty">
            Join hundreds of diagnostic centers delivering verified, tamper-proof medical reports. Start your 14-day free trial today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
            <Link
              to="/pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base bg-white text-slate-950 hover:bg-slate-100 shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>View Plans & Pricing</span>
              <ArrowRight className="w-5 h-5 text-brand-600" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-base bg-brand-800/80 hover:bg-brand-800 border border-white/20 text-white transition-all active:scale-[0.98]"
            >
              <span>Login to Workstation</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
