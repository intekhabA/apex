import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'normal' | 'low' | 'high' | 'critical' | 'pending' | 'final' | 'brand' | 'slate' | 'teal';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'slate',
  dot = false,
  className,
  ...props
}) => {
  const variants = {
    normal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    low: 'bg-amber-50 text-amber-700 border-amber-200',
    high: 'bg-rose-50 text-rose-700 border-rose-200',
    critical: 'bg-red-600 text-white font-bold border-red-700',
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    final: 'bg-blue-50 text-blue-700 border-blue-200',
    brand: 'bg-brand-50 text-brand-700 border-brand-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    teal: 'bg-teal-50 text-teal-700 border-teal-200',
  };

  const dotColors = {
    normal: 'bg-emerald-500',
    low: 'bg-amber-500',
    high: 'bg-rose-500',
    critical: 'bg-white',
    pending: 'bg-amber-500',
    final: 'bg-blue-500',
    brand: 'bg-brand-500',
    slate: 'bg-slate-400',
    teal: 'bg-teal-500',
  };

  return (
    <span
      className={twMerge(
        clsx(
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide uppercase',
          variants[variant],
          className
        )
      )}
      {...props}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
};
