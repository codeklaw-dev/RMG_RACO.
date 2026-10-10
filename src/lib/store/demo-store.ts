"use client";
// Guided demo progress. Session-scoped so a new tab starts fresh. The demo
// never blocks normal navigation; it's a bar, not a modal.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface DemoState {
  active: boolean;
  index: number;
  start: () => void;
  go: (i: number, total: number) => void;
  exit: () => void;
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      active: false,
      index: 0,
      start: () => set({ active: true, index: 0 }),
      go: (i, total) => set({ index: Math.min(Math.max(0, i), total - 1) }),
      exit: () => set({ active: false }),
    }),
    { name: "raco-demo", storage: createJSONStorage(() => sessionStorage), skipHydration: true },
  ),
);
