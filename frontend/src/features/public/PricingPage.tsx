import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  X,
  Sparkles,
  ArrowRight,
  Building2,
  Sliders,
  CheckCircle2
} from 'lucide-react';

export const PricingPage: React.FC = () => {
  const [isAnnual, setIsAnnual] = useState(true);
  const [estimatedSamples, setEstimatedSamples] = useState<number>(1200);

  // Determine recommended plan based on slider value
  const getRecommendedPlanKey = () => {
    if (estimatedSamples <= 500) return 'starter';
    if (estimatedSamples <= 3000) return 'pro';
    return 'enterprise';
  };

  const recommendedKey = getRecommendedPlanKey();

  const pricingPlans = [
    {
      key: 'starter',
      name: 'Starter Clinic',
      badge: 'Small Diagnostic Labs',
      description: 'Ideal for single-location clinics & entry-level diagnostic labs.',
      monthlyPrice: 49,
      annualPrice: 39,
      sampleLimit: 'Up to 500 samples/mo',
      usersLimit: 'Up to 3 Staff Accounts',
      locations: '1 Lab Location',
      popular: false,
      ctaText: 'Start 14-Day Free Trial',
      features: [
        'Standard Test Catalog (CBC, LFT, KFT)',
        'Standard PDF Medical Reports',
        'HMAC SHA-256 Public QR Verification',
        'Phlebotomy Worklist & Status Tracking',
        'Patient Management Portal',
        'Basic Financial Receipts & Invoicing',
        'Email Support (24h response time)',
      ],
      notIncluded: [
        'Automatic Biological Flag Calculation',
        'WhatsApp / SMS Automated Dispatch',
        'Referring Doctor Commission Engine',
        'Multi-Branch Collection Centers',
        'API & Webhook Integrations',
      ],
    },
    {
      key: 'pro',
      name: 'Professional',
      badge: 'Most Popular for Growing Labs',
      description: 'Built for high-volume diagnostic centers needing automation & commission tracking.',
      monthlyPrice: 149,
      annualPrice: 119,
      sampleLimit: 'Up to 3,000 samples/mo',
      usersLimit: 'Up to 15 Staff Accounts',
      locations: 'Up to 3 Lab Locations',
      popular: true,
      ctaText: 'Start 14-Day Free Trial',
      features: [
        'Everything in Starter Plan',
        'Automatic Biological Reference Calculator',
        'Custom PDF Templates with Pathologist Signature',
        'WhatsApp & SMS Automated Patient Dispatch',
        'Doctor Commission Rates & Monthly Statements',
        'Daily Expense Tracking & Financial Analytics',
        'Audit Logging & Security Role Matrix',
        'Priority Chat & Email Support',
      ],
      notIncluded: [
        'Unlimited Monthly Samples',
        'Dedicated Database Tenant Isolation',
        'Custom EMR / EHR API Integrations',
      ],
    },
    {
      key: 'enterprise',
      name: 'Enterprise',
      badge: 'Hospital Networks & Reference Labs',
      description: 'Unlimited capacity for multi-city lab chains and hospital diagnostic centers.',
      monthlyPrice: 399,
      annualPrice: 319,
      sampleLimit: 'Unlimited Monthly Samples',
      usersLimit: 'Unlimited Staff Accounts',
      locations: 'Unlimited Lab Branches',
      popular: false,
      ctaText: 'Contact Enterprise Sales',
      features: [
        'Everything in Professional Plan',
        'Unlimited Samples & Staff Accounts',
        'Dedicated Database Tenant Isolation',
        'REST API & Webhooks Access',
        'Custom Report Header / Watermark Engine',
        'Radiology & DICOM Imaging Integration',
        'Custom SLA Guarantee (99.99% Uptime)',
        '24/7 Phone Support & Dedicated Manager',
        'Custom Onboarding & Staff Training',
      ],
      notIncluded: [],
    },
  ];

  const comparisonFeatures = [
    {
      category: 'Capacity & Infrastructure',
      items: [
        { name: 'Monthly Sample Allowance', starter: '500', pro: '3,000', enterprise: 'Unlimited' },
        { name: 'Staff User Accounts', starter: '3 Users', pro: '15 Users', enterprise: 'Unlimited' },
        { name: 'Laboratory Locations', starter: '1 Branch', pro: '3 Branches', enterprise: 'Unlimited' },
        { name: 'Cloud Storage & Backups', starter: '10 GB (Daily)', pro: '100 GB (Daily)', enterprise: 'Unlimited (Real-Time)' },
      ],
    },
    {
      category: 'Diagnostic & Report Engine',
      items: [
        { name: 'Pre-Configured Test Catalogs', starter: true, pro: true, enterprise: true },
        { name: 'Biological Reference Calculator (High/Low)', starter: false, pro: true, enterprise: true },
        { name: 'HMAC SHA-256 QR Verification', starter: true, pro: true, enterprise: true },
        { name: 'Custom PDF Branding & Signatures', starter: 'Basic Logo', pro: 'Full Custom Signature', enterprise: 'Bespoke Templates' },
        { name: 'Radiology / Imaging Attachments', starter: false, pro: true, enterprise: true },
      ],
    },
    {
      category: 'Patient Dispatch & Financials',
      items: [
        { name: 'Patient Self-Service Portal', starter: true, pro: true, enterprise: true },
        { name: 'WhatsApp & SMS Automated Delivery', starter: false, pro: true, enterprise: true },
        { name: 'Referring Doctor Commission Engine', starter: false, pro: true, enterprise: true },
        { name: 'Expense Tracking & Profit Reports', starter: 'Basic Receipts', pro: 'Full Profit & Loss', enterprise: 'Advanced Financials' },
      ],
    },
    {
      category: 'Security & Compliance',
      items: [
        { name: 'HIPAA & ISO 15189 Security', starter: true, pro: true, enterprise: true },
        { name: 'Role-Based Access Control (RBAC)', starter: true, pro: true, enterprise: true },
        { name: 'Immutable Audit Logging', starter: false, pro: true, enterprise: true },
        { name: 'Dedicated Database Isolation', starter: false, pro: false, enterprise: true },
        { name: 'SLA Uptime Guarantee', starter: '99.5%', pro: '99.9%', enterprise: '99.99%' },
      ],
    },
  ];

  return (
    <div className="space-y-16 lg:space-y-24 pb-16 font-sans">
      {/* PRICING HERO SECTION */}
      <section className="bg-gradient-to-b from-slate-900 via-brand-950 to-slate-900 text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center space-y-6 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-brand-500/20 text-brand-300 border border-brand-400/30">
            <Sparkles className="w-3.5 h-3.5" /> Simple, Transparent Pricing
          </span>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Flexible Plans Built for Diagnostic Excellence
          </h1>

          <p className="text-slate-300 text-lg max-w-2xl mx-auto font-normal">
            No hidden setup fees or surprise charges. All plans include 14 days free trial, instant setup, and full access to core features.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="pt-6 flex items-center justify-center gap-4">
            <span className={`text-sm font-semibold ${!isAnnual ? 'text-white' : 'text-slate-400'}`}>
              Monthly Billing
            </span>

            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-16 h-8 rounded-full bg-brand-600 p-1 transition-colors duration-200 focus:outline-none shadow-inner"
              aria-label="Toggle annual billing"
            >
              <div
                className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                  isAnnual ? 'translate-x-8' : 'translate-x-0'
                }`}
              />
            </button>

            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${isAnnual ? 'text-white' : 'text-slate-400'}`}>
                Annual Billing
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500 text-slate-950 uppercase tracking-wide">
                Save 20%
              </span>
            </div>
          </div>

          {/* Interactive Volume Estimator Slider */}
          <div className="mt-10 max-w-xl mx-auto bg-white/5 border border-white/10 p-6 rounded-2xl backdrop-blur-md space-y-4 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-brand-400" /> Interactive Plan Finder
              </span>
              <span className="text-xs text-brand-300 font-medium">Estimated Samples / Month</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-2xl font-black text-white">
                {estimatedSamples.toLocaleString()} <span className="text-sm font-normal text-slate-400">tests/mo</span>
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-brand-500/20 text-brand-300 border border-brand-400/30 font-bold">
                Suggested Plan: {recommendedKey === 'starter' ? 'Starter Clinic' : recommendedKey === 'pro' ? 'Professional' : 'Enterprise'}
              </span>
            </div>

            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={estimatedSamples}
              onChange={(e) => setEstimatedSamples(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>100 samples</span>
              <span>1,500 samples</span>
              <span>3,000 samples</span>
              <span>5,000+ samples</span>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING CARDS GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pricingPlans.map((plan) => {
            const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;
            const isRecommendedBySlider = plan.key === recommendedKey;

            return (
              <div
                key={plan.key}
                className={`relative rounded-3xl bg-white transition-all duration-300 flex flex-col justify-between ${
                  plan.popular || isRecommendedBySlider
                    ? 'border-2 border-brand-500 shadow-2xl shadow-brand-500/10 md:-translate-y-4'
                    : 'border border-slate-200 shadow-lg'
                }`}
              >
                {/* Popular or Recommended Badge */}
                {(plan.popular || isRecommendedBySlider) && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 text-white text-xs font-black uppercase tracking-wider shadow-md">
                    {isRecommendedBySlider ? 'Recommended For Your Volume' : plan.badge}
                  </div>
                )}

                <div className="p-8 space-y-6">
                  {/* Header */}
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                      {plan.badge}
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 mt-1">{plan.name}</h3>
                    <p className="text-slate-500 text-sm mt-2 min-h-[40px] leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  {/* Price Block */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-slate-900">${price}</span>
                      <span className="text-slate-500 text-sm font-medium">/ month</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {isAnnual ? `Billed annually ($${price * 12}/yr)` : 'Billed monthly'}
                    </p>

                    <div className="mt-3 pt-3 border-t border-slate-200/60 flex flex-col gap-1 text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5 text-brand-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-600" /> {plan.sampleLimit}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" /> {plan.locations}
                      </span>
                    </div>
                  </div>

                  {/* Included Features List */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Included Features:</h4>
                    <ul className="space-y-2.5 text-sm">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-slate-700">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="leading-snug">{feat}</span>
                        </li>
                      ))}

                      {plan.notIncluded.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-slate-400">
                          <X className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                          <span className="line-through leading-snug">{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="p-8 pt-0">
                  <Link
                    to="/login"
                    className={`w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-sm transition-all shadow-md ${
                      plan.popular || isRecommendedBySlider
                        ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-600/25'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
                  >
                    <span>{plan.ctaText}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FEATURE COMPARISON MATRIX TABLE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12">
          <span className="text-brand-600 font-extrabold text-xs uppercase tracking-widest bg-brand-50 px-3 py-1 rounded-full border border-brand-100">
            Side-By-Side Comparison
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Detailed Feature Matrix
          </h2>
          <p className="text-slate-600 text-base">
            Compare all capabilities to choose the right plan for your laboratory.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-900 text-white text-sm">
                  <th className="p-5 font-bold w-2/5">Features & Capabilities</th>
                  <th className="p-5 font-bold text-center w-1/5">Starter Clinic</th>
                  <th className="p-5 font-bold text-center w-1/5 bg-brand-900 text-brand-200">
                    Professional
                  </th>
                  <th className="p-5 font-bold text-center w-1/5">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {comparisonFeatures.map((cat, cIdx) => (
                  <React.Fragment key={cIdx}>
                    <tr className="bg-slate-100/80 font-bold text-slate-900">
                      <td colSpan={4} className="py-3 px-5 text-xs uppercase tracking-wider text-brand-700">
                        {cat.category}
                      </td>
                    </tr>
                    {cat.items.map((item, iIdx) => (
                      <tr key={iIdx} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4 px-5 text-slate-800 font-medium">{item.name}</td>
                        <td className="p-4 text-center font-semibold text-slate-700">
                          {typeof item.starter === 'boolean' ? (
                            item.starter ? (
                              <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-slate-300 mx-auto" />
                            )
                          ) : (
                            item.starter
                          )}
                        </td>
                        <td className="p-4 text-center font-semibold text-slate-900 bg-brand-50/40">
                          {typeof item.pro === 'boolean' ? (
                            item.pro ? (
                              <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-slate-300 mx-auto" />
                            )
                          ) : (
                            item.pro
                          )}
                        </td>
                        <td className="p-4 text-center font-semibold text-slate-700">
                          {typeof item.enterprise === 'boolean' ? (
                            item.enterprise ? (
                              <Check className="w-5 h-5 text-emerald-500 mx-auto" />
                            ) : (
                              <X className="w-5 h-5 text-slate-300 mx-auto" />
                            )
                          ) : (
                            item.enterprise
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* PRICING FAQ SECTION */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center space-y-3 mb-10">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Billing Questions
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 text-base">Can I switch plans later?</h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              Yes, you can upgrade or downgrade your plan at any time directly from your Laboratory Settings panel. Plan upgrades take effect immediately with pro-rated billing.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 text-base">What payment methods do you accept?</h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              We accept all major credit cards (Visa, MasterCard, American Express), bank wire transfers, and ACH payments for annual enterprise invoices.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 text-base">Are there any hidden setup or migration fees?</h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              None! We provide free data import tools to help migrate your existing patient list and test catalog from CSV/Excel spreadsheets.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 text-base">Can I request a custom test panel?</h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              Yes! You can add unlimited custom tests, biological reference parameters, unit types, and price catalog entries inside your administration panel.
            </p>
          </div>
        </div>
      </section>

      {/* FINAL PRICING CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-12 text-center space-y-6 shadow-2xl border border-slate-800">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Start Your 14-Day Free Trial Today
          </h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            Experience the speed, accuracy, and security of TrustMyLab. No credit card required.
          </p>
          <div className="flex justify-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-black text-base bg-brand-500 hover:bg-brand-600 text-white shadow-xl shadow-brand-500/30 transition-all hover:scale-105"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
