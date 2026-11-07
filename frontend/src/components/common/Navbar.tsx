import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  LogOut,
  User,
  Building2,
  ChevronDown,
  Menu,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/store/uiStore';
import { Badge } from '@/components/ui';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { toggleSidebarMobile } = useUIStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const getRoleBadgeVariant = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'critical';
      case 'LAB_ADMIN':
        return 'brand';
      case 'PATHOLOGIST':
        return 'teal';
      case 'RADIOLOGIST':
        return 'teal';
      case 'LAB_ASSISTANT':
        return 'slate';
      case 'RECEPTIONIST':
        return 'slate';
      case 'PATIENT':
        return 'normal';
      default:
        return 'slate';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand & Lab Context */}
        <div className="flex items-center gap-3 sm:gap-5">
          {/* Mobile Sidebar Toggle */}
          <button
            onClick={toggleSidebarMobile}
            title="Open navigation menu"
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors focus:outline-none"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>

          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            {user?.lab_logo_url ? (
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 p-1 flex items-center justify-center shadow-xs overflow-hidden shrink-0 group-hover:border-brand-400 transition-colors">
                <img
                  src={`/storage/${user.lab_logo_url.replace(/^(\.\/)?storage\//, '')}`}
                  alt={user.lab_name || 'Laboratory Logo'}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:bg-brand-700 transition-colors">
                <Activity className="w-6 h-6" />
              </div>
            )}
            <div>
              <span className="font-extrabold text-lg text-slate-900 tracking-tight leading-none block">
                {user?.lab_name ? user.lab_name : <>TrustMy<span className="text-brand-600">Lab</span></>}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block mt-0.5">
                {user?.lab_name ? 'Certified Diagnostic Center' : 'LIMS Enterprise'}
              </span>
            </div>
          </Link>

          {/* Tenant Indicator */}
          <div className="hidden md:flex items-center gap-2 pl-5 border-l border-slate-200 text-sm">
            {user?.lab_logo_url ? (
              <img
                src={`/storage/${user.lab_logo_url.replace(/^(\.\/)?storage\//, '')}`}
                alt=""
                className="w-5 h-5 rounded object-contain border border-slate-200 shrink-0"
              />
            ) : (
              <Building2 className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-slate-500 font-medium text-xs">Workspace:</span>
            <span className="font-bold text-slate-800 text-xs truncate max-w-[220px]">
              {user?.lab_name || (user?.role === 'SUPER_ADMIN' ? 'Platform Management (All Labs)' : 'Self Service')}
            </span>
          </div>
        </div>

        {/* Right: User Menu */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all focus:outline-none"
          >
            <div className="w-9 h-9 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 font-bold text-sm">
              {user?.first_name?.[0] || 'U'}
              {user?.last_name?.[0] || ''}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-bold text-slate-800 leading-tight">
                {user?.full_name || user?.email}
              </p>
              <div className="mt-0.5">
                <Badge variant={getRoleBadgeVariant(user?.role)}>{user?.role}</Badge>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>

          {dropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Signed in as</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{user?.email}</p>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  My Profile & Security
                </Link>

                <div className="border-t border-slate-100 my-1" />

                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
