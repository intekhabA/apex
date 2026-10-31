import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UIState {
  isSidebarCollapsed: boolean;
  isSidebarOpenMobile: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarMobile: () => void;
  setSidebarOpenMobile: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarCollapsed: false,
      isSidebarOpenMobile: false,

      toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

      setSidebarCollapsed: (collapsed: boolean) =>
        set({ isSidebarCollapsed: collapsed }),

      toggleSidebarMobile: () =>
        set((state) => ({ isSidebarOpenMobile: !state.isSidebarOpenMobile })),

      setSidebarOpenMobile: (open: boolean) =>
        set({ isSidebarOpenMobile: open }),
    }),
    {
      name: 'diagnolab_ui_settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ isSidebarCollapsed: state.isSidebarCollapsed }),
    }
  )
);
