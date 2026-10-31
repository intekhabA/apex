import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  TestTubes,
  CalendarDays,
  FileSpreadsheet,
  FileCheck2,
  Receipt,
  Settings,
  ShieldCheck,
  Bell,
  User,
  Percent,
  Wallet,
  Scan,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useUIStore } from '@/store/uiStore';
import { clsx } from 'clsx';

export const Sidebar: React.FC = () => {
  const { isSuperAdmin, isPatient, role, hasPermission } = usePermissions();
  const {
    isSidebarCollapsed,
    toggleSidebar,
    isSidebarOpenMobile,
    setSidebarOpenMobile,
  } = useUIStore();

  const getNavLinks = () => {
    if (isSuperAdmin) {
      return [
        { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/admin/laboratories', label: 'Laboratories', icon: Building2 },
        { to: '/admin/imaging-templates', label: 'X-Ray & USG Templates', icon: Scan },
        { to: '/expenses', label: 'Daily Expenses', icon: Wallet },
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
    const baseStaffLinks = [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, permission: 'dashboard' },
      { to: '/patients', label: 'Patients', icon: Users, permission: 'patients' },
      { to: '/bookings', label: 'Bookings & Orders', icon: CalendarDays, permission: 'bookings' },
      { to: '/results', label: 'Results Entry (LFT/KFT/CBC)', icon: FileSpreadsheet, permission: 'results' },
      { to: '/reports', label: 'Reports & Approvals', icon: FileCheck2, permission: 'reports' },
      { to: '/templates', label: 'Report & USG Templates', icon: Scan, permission: 'reports' },
      { to: '/invoices', label: 'Billing & Invoices', icon: Receipt, permission: 'invoices' },
      { to: '/expenses', label: 'Daily Expenses', icon: Wallet, permission: 'expenses' },
      { to: '/doctor-commissions', label: 'Doctor Commissions', icon: Percent, permission: 'doctor_commissions' },
      { to: '/notifications', label: 'Patient Alerts & Logs', icon: Bell, permission: 'notifications' },
      { to: '/tests/catalog', label: 'Test Catalog & Pricing', icon: TestTubes, permission: 'tests' },
    ];

    const accessibleLinks = baseStaffLinks.filter(
      (link) => !link.permission || hasPermission(link.permission)
    );

    const adminLinks =
      role === 'LAB_ADMIN'
        ? [
            { to: '/settings/lab', label: 'Laboratory Profile', icon: Building2 },
            { to: '/settings/staff', label: 'Staff Management', icon: Users },
            { to: '/settings/reports', label: 'Report Settings', icon: Settings },
            { to: '/audit/logs', label: 'Lab Audit Logs', icon: ShieldCheck },
          ]
        : [];

    return [...accessibleLinks, ...adminLinks];
  };

  const navLinks = getNavLinks();

  return (
    <aside
      className={clsx(
        'bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 select-none shadow-sm md:shadow-none',
        // Mobile drawer positioning vs Desktop sticky positioning
        'fixed inset-y-0 left-0 z-40 md:sticky md:top-16 md:self-start md:z-20 md:translate-x-0',
        isSidebarOpenMobile ? 'translate-x-0' : '-translate-x-full',
        // Desktop collapsed vs expanded width
        isSidebarCollapsed ? 'md:w-16 p-2' : 'md:w-64 p-3.5',
        'w-64 p-3.5 h-[calc(100vh-4rem)] overflow-y-auto overflow-x-hidden'
      )}
    >
      <div className="space-y-1">
        {/* Mobile Header with close button */}
        <div className="flex md:hidden items-center justify-between pb-3 mb-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Menu
          </span>
          <button
            onClick={() => setSidebarOpenMobile(false)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop Header: When open, toggle button on the right of "Navigation" text */}
        {!isSidebarCollapsed ? (
          <div className="hidden md:flex items-center justify-between px-3 pb-1 mb-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Navigation
            </p>
            <button
              onClick={toggleSidebar}
              title="Collapse sidebar"
              className="p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors focus:outline-none"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Desktop Header: When closed, toggle button at the top of the sidebar */
          <div className="hidden md:flex items-center justify-center pb-2 mb-2 border-b border-slate-100">
            <button
              onClick={toggleSidebar}
              title="Expand sidebar"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors group relative focus:outline-none"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-5 h-5 text-slate-500 group-hover:text-slate-800" />
              <span className="hidden md:group-hover:block absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md whitespace-nowrap shadow-xl z-50 pointer-events-none">
                Expand sidebar
              </span>
            </button>
          </div>
        )}

        {/* Navigation Items */}
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpenMobile(false)}
              title={isSidebarCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                clsx(
                  'rounded-lg font-semibold transition-colors group relative flex items-center',
                  isSidebarCollapsed
                    ? 'justify-center p-2.5 my-1'
                    : 'gap-3 px-3 py-2.5 text-sm',
                  isActive
                    ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-200/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )
              }
            >
              <Icon className={clsx('shrink-0', isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4')} />
              {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}

              {/* Floating Tooltip when collapsed */}
              {isSidebarCollapsed && (
                <span className="hidden md:group-hover:block absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md whitespace-nowrap shadow-xl z-50 pointer-events-none">
                  {item.label}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Footer / Profile */}
      <div className="pt-3 border-t border-slate-100">
        <NavLink
          to="/profile"
          onClick={() => setSidebarOpenMobile(false)}
          title={isSidebarCollapsed ? 'My Profile & Settings' : undefined}
          className={({ isActive }) =>
            clsx(
              'rounded-lg font-semibold transition-colors group relative flex items-center',
              isSidebarCollapsed
                ? 'justify-center p-2.5'
                : 'gap-3 px-3 py-2.5 text-sm',
              isActive
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            )
          }
        >
          <User className={clsx('shrink-0 text-slate-400', isSidebarCollapsed ? 'w-5 h-5' : 'w-4 h-4')} />
          {!isSidebarCollapsed && <span className="truncate">My Profile & Settings</span>}

          {isSidebarCollapsed && (
            <span className="hidden md:group-hover:block absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md whitespace-nowrap shadow-xl z-50 pointer-events-none">
              My Profile & Settings
            </span>
          )}
        </NavLink>
      </div>
    </aside>
  );
};
