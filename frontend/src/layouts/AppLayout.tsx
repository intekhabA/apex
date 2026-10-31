import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar, Sidebar } from '@/components/common';
import { useUIStore } from '@/store/uiStore';

export const AppLayout: React.FC = () => {
  const { isSidebarOpenMobile, setSidebarOpenMobile } = useUIStore();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex relative">
        {/* Mobile Backdrop Overlay */}
        {isSidebarOpenMobile && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 md:hidden transition-opacity"
            onClick={() => setSidebarOpenMobile(false)}
          />
        )}
        <Sidebar />
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
