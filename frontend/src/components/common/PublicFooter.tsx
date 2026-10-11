import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ShieldCheck, CheckCircle2, Lock, FileText } from 'lucide-react';

export const PublicFooter: React.FC = () => {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Column 1: Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/30">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black tracking-tight text-white">
                Diagno<span className="text-brand-400">Lab</span>
              </span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              DiagnoLab Apex is a cloud-native, multi-tenant LIMS platform built for modern diagnostic centers, hospital networks, and pathology laboratories.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-teal-300 border border-slate-700">
                <ShieldCheck className="w-3.5 h-3.5" /> HIPAA Compliant
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-brand-300 border border-slate-700">
                <Lock className="w-3.5 h-3.5" /> HMAC SHA-256 QR
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-amber-300 border border-slate-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> ISO 15189 Ready
              </span>
            </div>
          </div>

          {/* Column 2: Product */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Product & Core</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/" className="hover:text-white transition-colors">Overview</Link>
              </li>
              <li>
                <Link to="/pricing" className="hover:text-white transition-colors font-medium text-brand-400">Pricing & Plans</Link>
              </li>
              <li>
                <a href="/#features" className="hover:text-white transition-colors">Sample Tracking</a>
              </li>
              <li>
                <a href="/#features" className="hover:text-white transition-colors">Report Engine (PDF)</a>
              </li>
              <li>
                <a href="/#features" className="hover:text-white transition-colors">Patient Portal</a>
              </li>
              <li>
                <a href="/#features" className="hover:text-white transition-colors">Doctor Commission Engine</a>
              </li>
            </ul>
          </div>

          {/* Column 3: Solutions */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Solutions</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <a href="/#solutions" className="hover:text-white transition-colors">Pathology Centers</a>
              </li>
              <li>
                <a href="/#solutions" className="hover:text-white transition-colors">Radiology & Imaging</a>
              </li>
              <li>
                <a href="/#solutions" className="hover:text-white transition-colors">Hospital Networks</a>
              </li>
              <li>
                <a href="/#solutions" className="hover:text-white transition-colors">Multi-Branch Chains</a>
              </li>
              <li>
                <a href="/#solutions" className="hover:text-white transition-colors">Reference Laboratories</a>
              </li>
            </ul>
          </div>

          {/* Column 4: Resources & Compliance */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Resources</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <Link to="/verify/demo" className="hover:text-white transition-colors">QR Verification Portal</Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white transition-colors">Workstation Login</Link>
              </li>
              <li>
                <a href="/#faq" className="hover:text-white transition-colors">Knowledge Base & FAQ</a>
              </li>
              <li>
                <span className="hover:text-white cursor-pointer transition-colors flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" /> API Specification
                </span>
              </li>
              <li>
                <span className="hover:text-white cursor-pointer transition-colors flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  System Status: 99.99%
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright & disclosures */}
        <div className="mt-12 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center gap-2">
            <span>&copy; {new Date().getFullYear()} DiagnoLab Technologies Inc. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-slate-400 transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-slate-400 transition-colors cursor-pointer">Terms of Service</span>
            <span className="hover:text-slate-400 transition-colors cursor-pointer">Security Whitepaper</span>
            <span className="hover:text-slate-400 transition-colors cursor-pointer">HIPAA Compliance</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
