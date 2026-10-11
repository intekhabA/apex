import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Menu, X, ArrowRight, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export const PublicHeader: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 transition-all duration-200">
      {/* Top Banner Notice */}
      <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 text-white text-xs py-1.5 px-4 text-center flex items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1 bg-brand-500/30 text-brand-200 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-brand-400/20">
          <Sparkles className="w-3 h-3 text-brand-300" /> New Release 2.4
        </span>
        <span className="hidden sm:inline text-slate-300">
          Automated Biological Reference Calculator & HMAC SHA-256 Verified Medical Reports
        </span>
        <Link
          to="/pricing"
          className="underline hover:text-brand-300 transition-colors font-medium ml-1"
        >
          Explore Pricing &rarr;
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
              <Activity className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight text-slate-900 group-hover:text-brand-700 transition-colors">
                Diagno<span className="text-brand-600">Lab</span>
              </span>
              <span className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase -mt-1">
                LIMS & Clinical Software
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <Link
              to="/"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/')
                  ? 'text-brand-700 bg-brand-50/80 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              Home
            </Link>
            <a
              href="/#features"
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors"
            >
              Features
            </a>
            <a
              href="/#solutions"
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors"
            >
              Solutions
            </a>
            <Link
              to="/pricing"
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                isActive('/pricing')
                  ? 'text-brand-700 bg-brand-50/80 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              Pricing
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
              </span>
            </Link>
            <a
              href="/#faq"
              className="px-3.5 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors"
            >
              FAQ
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white shadow-sm hover:bg-brand-700 transition-all shadow-brand-600/20"
              >
                <span>Dashboard ({user?.first_name || 'Portal'})</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-brand-600 text-white shadow-sm hover:bg-brand-700 transition-all shadow-brand-600/20 group"
                >
                  <span>Start Free Trial</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-xl">
          <div className="flex flex-col space-y-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded-md text-base font-medium ${
                isActive('/') ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              Home
            </Link>
            <a
              href="/#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              Features
            </a>
            <a
              href="/#solutions"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              Solutions
            </a>
            <Link
              to="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className={`px-3 py-2 rounded-md text-base font-medium flex items-center justify-between ${
                isActive('/pricing') ? 'bg-brand-50 text-brand-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>Pricing</span>
              <span className="px-2 py-0.5 text-xs font-bold bg-brand-100 text-brand-800 rounded-full">
                Plans
              </span>
            </Link>
            <a
              href="/#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-base font-medium text-slate-700 hover:bg-slate-50"
            >
              FAQ
            </a>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2.5 rounded-lg text-base font-semibold bg-brand-600 text-white shadow-sm hover:bg-brand-700"
              >
                Go to Workstation Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2.5 rounded-lg text-base font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200"
                >
                  Sign In to Workstation
                </Link>
                <Link
                  to="/pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2.5 rounded-lg text-base font-semibold bg-brand-600 text-white shadow-sm hover:bg-brand-700"
                >
                  Start 14-Day Free Trial
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
