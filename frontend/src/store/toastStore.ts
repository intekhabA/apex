import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastStoreState {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],
  addToast: (toastItem) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = { ...toastItem, id };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // Auto-dismiss after duration (default 4000ms, or 5000ms for errors)
    const duration =
      toastItem.duration ?? (toastItem.type === 'error' ? 5000 : 3500);

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }

    return id;
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  clearToasts: () => {
    set({ toasts: [] });
  },
}));

// Direct helper utility for imperative calls
export const toast = {
  success: (message: string, title: string = 'Success', duration?: number) =>
    useToastStore.getState().addToast({ type: 'success', title, message, duration }),

  error: (message: string, title: string = 'Error', duration?: number) =>
    useToastStore.getState().addToast({ type: 'error', title, message, duration }),

  warning: (message: string, title: string = 'Warning', duration?: number) =>
    useToastStore.getState().addToast({ type: 'warning', title, message, duration }),

  info: (message: string, title: string = 'Notice', duration?: number) =>
    useToastStore.getState().addToast({ type: 'info', title, message, duration }),
};
