import { create } from 'zustand';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions;
  resolver: ((value: boolean) => void) | null;
  open: (options: ConfirmOptions) => Promise<boolean>;
  close: (result: boolean) => void;
}

const DEFAULT_OPTIONS: ConfirmOptions = {
  title: 'Are you sure?',
  message: 'Are you sure you want to proceed with this action?',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'danger',
};

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: DEFAULT_OPTIONS,
  resolver: null,
  open: (options) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        options: {
          ...DEFAULT_OPTIONS,
          ...options,
        },
        resolver: resolve,
      });
    });
  },
  close: (result) => {
    const { resolver } = get();
    if (resolver) {
      resolver(result);
    }
    set({
      isOpen: false,
      resolver: null,
    });
  },
}));

/**
 * Global promise-based confirmation dialog.
 * Resolves to `true` if the user confirms, `false` otherwise.
 */
export const confirmDialog = (options: ConfirmOptions): Promise<boolean> => {
  return useConfirmStore.getState().open(options);
};
