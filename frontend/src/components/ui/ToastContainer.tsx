import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, ToastItem, ToastType } from '@/store/toastStore';

const TOAST_CONFIG: Record<
  ToastType,
  {
    icon: React.FC<{ className?: string }>;
    bg: string;
    border: string;
    iconColor: string;
    titleColor: string;
    msgColor: string;
  }
> = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    iconColor: 'text-emerald-600',
    titleColor: 'text-emerald-900',
    msgColor: 'text-emerald-800',
  },
  error: {
    icon: AlertCircle,
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    iconColor: 'text-rose-600',
    titleColor: 'text-rose-900',
    msgColor: 'text-rose-800',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-600',
    titleColor: 'text-amber-900',
    msgColor: 'text-amber-800',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconColor: 'text-blue-600',
    titleColor: 'text-blue-900',
    msgColor: 'text-blue-800',
  },
};

const ToastMessage: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  const config = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const Icon = config.icon;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg ${config.bg} ${config.border} transition-all transform animate-in slide-in-from-top-2 fade-in duration-200`}
      role="alert"
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${config.iconColor}`} />
      <div className="flex-1 min-w-0 pr-1">
        {toast.title && (
          <h5 className={`font-bold text-sm leading-tight ${config.titleColor}`}>
            {toast.title}
          </h5>
        )}
        <p className={`text-xs mt-0.5 leading-relaxed break-words ${config.msgColor}`}>
          {toast.message}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 -mr-1 -mt-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((item) => (
        <ToastMessage key={item.id} toast={item} onDismiss={() => removeToast(item.id)} />
      ))}
    </div>
  );
};
