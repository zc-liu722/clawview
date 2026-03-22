import { create } from "zustand";

import { TOAST_DURATION_MS } from "@/lib/constants";

export interface ToastItem {
  id: string;
  title: string;
}

interface ToastState {
  items: ToastItem[];
  push: (title: string) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (title) => {
    const id = crypto.randomUUID();
    set((state) => ({
      items: [...state.items, { id, title }],
    }));
    window.setTimeout(() => {
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      }));
    }, TOAST_DURATION_MS);
  },
  remove: (id) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    }));
  },
}));
