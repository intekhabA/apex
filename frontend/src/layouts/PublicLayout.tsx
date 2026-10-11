import React from 'react';
import { Outlet } from 'react-router-dom';
import { PublicHeader } from '@/components/common/PublicHeader';
import { PublicFooter } from '@/components/common/PublicFooter';

interface PublicLayoutProps {
  children?: React.ReactNode;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-brand-500 selection:text-white">
      <PublicHeader />
      <main className="flex-1">
        {children || <Outlet />}
      </main>
      <PublicFooter />
    </div>
  );
};
