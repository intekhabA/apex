import React from 'react';
import { Activity, ShieldCheck, Database, FileCheck2, Cpu } from 'lucide-react';

export interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Left Clinical Brand Banner */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Abstract Background Accents */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-brand-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-lg">
              <Activity className="w-6 h-6 text-brand-300" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-white">
                Diagno<span className="text-brand-400">Lab</span>
              </span>
              <p className="text-xs text-brand-200 uppercase tracking-widest font-semibold">
                Multi-Tenant LIMS Platform
              </p>
            </div>
          </div>
        </div>

        {/* Hero Value Props */}
        <div className="relative z-10 space-y-8 max-w-lg">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/20 border border-brand-400/30 text-brand-200 mb-4">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-300" /> Enterprise Multi-Tenancy Architecture
            </span>
            <h1 className="text-3xl font-extrabold leading-snug tracking-tight text-white">
              Intelligent Laboratory Information & Diagnostic Reporting
            </h1>
            <p className="mt-3 text-slate-300 text-sm leading-relaxed">
              Strict multi-tenant cryptographic isolation, automated biological reference flag calculations,
              and tamper-proof QR-verified digital medical reports.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <Database className="w-5 h-5 text-brand-400 mb-2" />
              <h4 className="text-sm font-bold text-white">Tenant Isolated</h4>
              <p className="text-xs text-slate-300 mt-1">
                Zero cross-tenant data leakage guaranteed at the ORM layer.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <FileCheck2 className="w-5 h-5 text-teal-400 mb-2" />
              <h4 className="text-sm font-bold text-white">ReportLab Engine</h4>
              <p className="text-xs text-slate-300 mt-1">
                Pixel-perfect medical PDF reports with HMAC SHA-256 seal.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <Cpu className="w-5 h-5 text-emerald-400 mb-2" />
              <h4 className="text-sm font-bold text-white">Calculations</h4>
              <p className="text-xs text-slate-300 mt-1">
                Instant biological flag evaluation for CBC, LFT & KFT panels.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <ShieldCheck className="w-5 h-5 text-indigo-400 mb-2" />
              <h4 className="text-sm font-bold text-white">RBAC Matrix</h4>
              <p className="text-xs text-slate-300 mt-1">
                Granular security across Super Admins, Pathologists, and Radiologists.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-6">
          <span>&copy; {new Date().getFullYear()} DiagnoLab Platform</span>
          <span className="flex items-center gap-1.5 text-brand-300 font-medium">
            <ShieldCheck className="w-4 h-4" /> HIPAA & Clinical Security Standard
          </span>
        </div>
      </div>

      {/* Right Form Shell */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
};
