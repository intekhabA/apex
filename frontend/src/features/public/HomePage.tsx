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
  TrendingUp,
  Sparkles,
  ChevronDown,
  FlaskConical,
  ChevronRight
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How fast can our laboratory get started with TrustMyLab?',
      a: 'You can launch your lab account in less than 5 minutes! Our pre-configured test catalogs (CBC, LFT, KFT, Thyroid, Lipid, Urine) and built-in PDF report templates allow you to start booking patients immediately.',
    },
    {
      q: 'Is our patient health data secure and HIPAA compliant?',
      a: 'Yes. TrustMyLab uses enterprise multi-tenant isolation at the database/ORM layer. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Reports feature cryptographic HMAC SHA-256 signatures and instant QR code verification.',
    },
    {
      q: 'Can we customize report templates with our lab logo and doctor signatures?',
      a: 'Absolutely. You can upload custom header/footer logos, digital signatures of pathologists/radiologists, brand accent colors, and custom reference ranges.',
    },
    {
      q: 'Does TrustMyLab support multi-branch collection centers?',
      a: 'Yes! Our Professional and Enterprise plans support multi-branch workflows where sample collection occurs at remote centers and processing happens at the central lab.',
    },
    {
      q: 'What happens when our 14-day free trial ends?',
      a: 'You can seamlessly select any of our Starter, Professional, or Enterprise subscription plans. All your test catalog data, patient records, and configuration settings will remain intact.',
    },
  ];

  return (
    <div className="space-y-16 lg:space-y-24 pb-16 font-sans">
      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24 bg-gradient-to-b from-slate-900 via-brand-950 to-slate-900 text-white">
        {/* Glowing Gradient Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-500/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-teal-500/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-brand-300 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-brand-400" />
              <span>Next-Gen Multi-Tenant Clinical LIMS Software</span>
              <span className="bg-brand-500 text-white px-2 py-0.5 rounded-full text-[10px]">v2.4</span>
            </div>

            {/* Main Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.15]">
              Intelligent Diagnostic & Lab Management <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-brand-400 to-teal-300">Made Effortless</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-slate-300 font-normal leading-relaxed">
              Streamline phlebotomy worklists, automate biological reference flag calculations, dispatch tamper-proof QR medical reports, and track revenue — all from a unified platform.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                to="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-base bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white shadow-xl shadow-brand-500/25 hover:scale-[1.02] transition-all"
              >
                <span>Start 14-Day Free Trial</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <Link
                to="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-bold text-base bg-white/10 hover:bg-white/15 border border-white/20 text-white backdrop-blur-md transition-all"
              >
                <span>View Pricing Plans</span>
                <ChevronRight className="w-5 h-5 text-slate-400" />
              </Link>
            </div>

            {/* Security Callouts */}
            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" /> No Credit Card Required
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-brand-400" /> HIPAA & ISO 15189 Compliant
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-amber-400" /> Cryptographic HMAC SHA-256 PDF Seal
              </span>
            </div>
          </div>

          {/* Interactive Mock Dashboard Showcase */}
          <div className="mt-12 lg:mt-16 max-w-5xl mx-auto">
            <div className="relative rounded-2xl bg-slate-800/80 p-2 sm:p-4 border border-white/10 shadow-2xl backdrop-blur-xl">
              {/* Top Window Dots */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 mb-3">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs font-mono text-slate-400">trustmylab.in/workstation</span>
                <span className="ml-auto px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> LIVE SYSTEM
                </span>
              </div>

              {/* Mock Dashboard Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left p-2 sm:p-4">
                {/* Card 1: Sample Status */}
                <div className="bg-slate-900/90 rounded-xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Daily Worklist</span>
                    <FlaskConical className="w-4 h-4 text-brand-400" />
                  </div>
                  <div className="text-2xl font-black text-white">148 Samples</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Phlebotomy Collected</span>
                      <span className="font-semibold text-emerald-400">112 (76%)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full w-[76%]" />
                    </div>
                  </div>
                </div>

                {/* Card 2: Auto Calculation */}
                <div className="bg-slate-900/90 rounded-xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Biological Flagging</span>
                    <Zap className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-sm font-bold text-slate-200">Hemoglobin (Hb): 10.2 g/dL</div>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    &darr; LOW FLAG (Ref: 12.0 - 15.5)
                  </div>
                  <p className="text-[11px] text-slate-400">Auto-flagged by adult female reference matrix.</p>
                </div>

                {/* Card 3: QR Report Seal */}
                <div className="bg-slate-900/90 rounded-xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-medium">Report Security</span>
                    <QrCode className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded flex items-center justify-center text-slate-900">
                      <QrCode className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">HMAC SHA-256 Verified</div>
                      <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Anti-Tamper Sealed
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* METRICS & STATS BAR */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-xl shadow-slate-200/50 grid grid-cols-2 lg:grid-cols-4 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          <div className="text-center space-y-1">
            <div className="text-3xl sm:text-4xl font-black text-brand-600">500+</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Labs & Clinics</div>
          </div>
          <div className="text-center space-y-1 pt-4 lg:pt-0">
            <div className="text-3xl sm:text-4xl font-black text-teal-600">10M+</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Reports Generated</div>
          </div>
          <div className="text-center space-y-1 pt-4 lg:pt-0">
            <div className="text-3xl sm:text-4xl font-black text-indigo-600">&lt; 1.2s</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">PDF Render Latency</div>
          </div>
          <div className="text-center space-y-1 pt-4 lg:pt-0">
            <div className="text-3xl sm:text-4xl font-black text-emerald-600">99.99%</div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Guaranteed SLA Uptime</div>
          </div>
        </div>
      </section>

      {/* SOLUTIONS SECTION */}
      <section id="solutions" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <span className="text-brand-600 font-extrabold text-xs uppercase tracking-widest bg-brand-50 px-3 py-1 rounded-full border border-brand-100">
            Tailored For Healthcare Providers
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Designed for Every Diagnostic Scale
          </h2>
          <p className="text-slate-600 text-base">
            From single-doctor standalone clinics to multi-city reference laboratories.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Solution 1 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <FlaskConical className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Pathology Laboratories</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Automate routine blood panels, microbiology worklists, sample barcodes, and biological reference flag calculations.
            </p>
            <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Pre-built Test Catalog</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Panic Value Alerts</li>
            </ul>
          </div>

          {/* Solution 2 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Imaging & Radiology</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Attach X-Ray, MRI, Ultrasound, and ECG diagnostic reports with custom clinical impression notes and DICOM links.
            </p>
            <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Radiologist Signatures</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Image Attachments</li>
            </ul>
          </div>

          {/* Solution 3 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Multi-Branch Chains</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Centralized administrative dashboard for collection centers, logistics tracking, and inter-branch sample transfers.
            </p>
            <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Multi-Tenant Architecture</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Central Financial Audit</li>
            </ul>
          </div>

          {/* Solution 4 */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow space-y-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Polyclinics & Hospitals</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Seamlessly connect referring physicians, compute commissions, generate invoices, and dispatch patient updates via SMS.
            </p>
            <ul className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Doctor Commission Engine</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Patient Portal Access</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CORE FEATURES SECTION */}
      <section id="features" className="bg-slate-100/70 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-brand-600 font-extrabold text-xs uppercase tracking-widest bg-brand-100/80 px-3 py-1 rounded-full">
              Enterprise Feature Matrix
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Everything Your Lab Needs to Run Flawlessly
            </h2>
            <p className="text-slate-600 text-base">
              Built ground-up with precision engineering for clinical workflows and audit compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <FlaskConical className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Sample & Phlebotomy Management</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Assign barcode tube IDs, track collection times, log specimen types (EDTA, Serum, Plasma), and manage phlebotomy queues.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Biological Reference Calculator</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Instant automatic calculation of abnormal biological flags (High/Low/Critical) tailored by patient age, gender, and test method.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">HMAC SHA-256 PDF Engine</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Generate high-resolution, vector PDF medical reports featuring custom lab headers, doctor signatures, and tamper-proof verification seals.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Instant Public QR Verification</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Every printed or digital report carries a dynamic QR code. Patients and doctors can scan to verify original report authenticity instantly.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Invoicing & Doctor Commissions</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Track lab revenue, issue patient receipts, log daily laboratory expenses, and calculate referring doctor commission payouts automatically.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Strict RBAC & Audit Trails</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Granular security matrix separating Super Admins, Lab Admins, Pathologists, Radiologists, and Technicians with full activity logging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING HIGHLIGHT / TEASER BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-br from-brand-900 via-brand-950 to-slate-900 text-white p-8 sm:p-12 overflow-hidden shadow-2xl border border-brand-800">
          <div className="absolute right-0 top-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl text-center lg:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-400/30">
                <Sparkles className="w-3.5 h-3.5" /> Transparent SaaS Pricing
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Simple, Predictable Plans starting at just <span className="text-brand-400">$49/month</span>
              </h2>
              <p className="text-slate-300 text-base leading-relaxed">
                Choose a plan tailored to your lab volume. No hidden setup fees, free data migration assistance, and 14 days free with no credit card required.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <Link
                to="/pricing"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-black text-base bg-white text-brand-900 hover:bg-slate-100 shadow-xl transition-all hover:scale-105"
              >
                <span>Explore All Pricing Plans</span>
                <ArrowRight className="w-5 h-5 text-brand-700" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <span className="text-brand-600 font-extrabold text-xs uppercase tracking-widest bg-brand-50 px-3 py-1 rounded-full border border-brand-100">
            Trusted By Pathologists
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            What Laboratory Leaders Say
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex text-amber-400 gap-1 text-sm">★★★★★</div>
            <p className="text-slate-600 text-sm italic leading-relaxed">
              "TrustMyLab transformed our daily workflow. The biological reference flag calculation saves our pathologists hours every day, and patients love receiving instant WhatsApp report links."
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center text-sm">
                DR
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Dr. Rajesh Sharma</div>
                <div className="text-xs text-slate-500">Chief Pathologist, Apex Diagnostics</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex text-amber-400 gap-1 text-sm">★★★★★</div>
            <p className="text-slate-600 text-sm italic leading-relaxed">
              "The HMAC QR code verification on PDF reports has eliminated sample report tampering completely. Our referring doctors trust the reports 100%."
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-sm">
                MP
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Meera Patel</div>
                <div className="text-xs text-slate-500">Lab Operations Director, Metro Care</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex text-amber-400 gap-1 text-sm">★★★★★</div>
            <p className="text-slate-600 text-sm italic leading-relaxed">
              "Managing referring doctor commission rates used to be a nightmare on spreadsheets. TrustMyLab calculates commissions and exports statements with one click."
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-sm">
                AK
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900">Dr. Anil Kapoor</div>
                <div className="text-xs text-slate-500">Founder, LifeLine Diagnostics</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-10">
          <span className="text-brand-600 font-extrabold text-xs uppercase tracking-widest bg-brand-50 px-3 py-1 rounded-full border border-brand-100">
            Got Questions?
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm transition-all"
            >
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full p-5 text-left flex items-center justify-between font-bold text-slate-900 hover:text-brand-600 transition-colors focus:outline-none"
              >
                <span className="text-base">{faq.q}</span>
                <ChevronDown
                  className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${
                    openFaq === index ? 'rotate-180 text-brand-600' : ''
                  }`}
                />
              </button>

              {openFaq === index && (
                <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* BOTTOM CTA BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-gradient-to-r from-brand-600 via-brand-700 to-indigo-800 text-white p-8 sm:p-12 text-center space-y-6 shadow-xl">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight max-w-2xl mx-auto">
            Ready to Automate Your Diagnostic Laboratory?
          </h2>
          <p className="text-brand-100 text-base max-w-xl mx-auto">
            Get full access to all features for 14 days. No setup fees, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              to="/pricing"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-extrabold text-base bg-white text-brand-900 hover:bg-slate-100 shadow-lg transition-all"
            >
              <span>View Plans & Pricing</span>
              <ArrowRight className="w-5 h-5 text-brand-600" />
            </Link>
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-bold text-base bg-brand-800/60 hover:bg-brand-800 border border-white/20 text-white transition-all"
            >
              <span>Login to Workstation</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
