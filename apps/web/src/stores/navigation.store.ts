import { create } from "zustand";

export type NavigationTab = "live" | "tasks" | "cost" | "memory" | "alerts";

interface NavigationState {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  activeTab: "live",
  setActiveTab: (tab) => {
    set({ activeTab: tab });
  },
}));
