"use client";
// Client-side demo state, persisted to localStorage. In production this is
// replaced by server state (TanStack Query over /api/v1).
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CONCEPTS } from "@/lib/fixtures";
import type { Concept, ID } from "@/lib/types/domain";

interface StudioState {
  concepts: Concept[];
  toggleFavorite: (id: ID) => void;
  reset: () => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set) => ({
      concepts: CONCEPTS,
      toggleFavorite: (id) =>
        set((s) => ({ concepts: s.concepts.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c)) })),
      reset: () => set({ concepts: CONCEPTS }),
    }),
    { name: "raco-studio-v1", skipHydration: true },
  ),
);
