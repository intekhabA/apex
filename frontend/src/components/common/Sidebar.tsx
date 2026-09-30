import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  TestTubes,
  CalendarDays,
  Pipette,
  FileSpreadsheet,
  FileCheck2,
  Receipt,
  Settings,
  ShieldCheck,
  Bell,
  User,
  Percent,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
  const { isSuperAdmin, isPatient, role } = usePermissions();

  const getNavLinks = () => {
    if (isSuperAdmin) {
      return [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/admin/laboratories', label: 'Laboratories', icon: Building2 },
        { to: '/tests/catalog', label: 'Master Test Catalog', icon: TestTubes },
        { to: '/notifications', label: 'Global Notifications', icon: Bell },
        { to: '/audit/logs', label: 'Platform Audit Logs', icon: ShieldCheck },
      ];
    }

    if (isPatient) {
      return [
        { to: '/dashboard', label: 'My Dashboard', icon: LayoutDashboard },
        { to: '/patient/reports', label: 'My Medical Reports', icon: FileCheck2 },
        { to: '/patient/bookings', label: 'Appointments & Tests', icon: CalendarDays },
        { to: '/patient/invoices', label: 'Invoices & Receipts', icon: Receipt },
      ];
    }

    // Lab Staff (Lab Admin, Pathologist, Radiologist, Lab Assistant, Receptionist)
    return [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
      { to: '/patients', label: 'Patients', icon: Users },
      { to: '/bookings', label: 'Bookings & Orders', icon: CalendarDays },
      { to: '/samples', label: 'Phlebotomy / Samples', icon: Pipette },
      { to: '/results', label: 'Results Entry (LFT/KFT/CBC)', icon: FileSpreadsheet },
      { to: '/reports', label: 'Reports & Approvals', icon: FileCheck2 },
      { to: '/invoices', label: 'Billing & Invoices', icon: Receipt },
      { to: '/doctor-commissions', label: 'Doctor Commissions', icon: Percent },
      { to: '/notifications', label: 'Patient Alerts & Logs', icon: Bell },
      { to: '/tests/catalog', label: 'Test Catalog & Pricing', icon: TestTubes },
      ...(role === 'LAB_ADMIN'
        ? [
            { to: '/settings/lab', label: 'Laboratory Profile', icon: Building2 },
            { to: '/settings/staff', label: 'Staff Management', icon: Users },
            { to: '/settings/reports', label: 'Report Settings', icon: Settings },
            { to: '/audit/logs', label: 'Lab Audit Logs', icon: ShieldCheck },
          ]
        : []),
    ];
  };

  const navLinks = getNavLinks();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4">
      <div className="space-y-1">
        <p className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Navigation
        </p>
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-200/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-100">
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors',
              isActive
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            )
          }
        >
          <User className="w-4 h-4 text-slate-400" />
          <span>My Profile & Settings</span>
        </NavLink>
      </div>
    </aside>
  );
};
