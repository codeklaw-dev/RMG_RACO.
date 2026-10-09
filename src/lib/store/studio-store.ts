"use client";
// Client-side demo state, persisted to localStorage (metadata only — never image data).
// In production this is replaced by server state over /api/v1.
import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { COLLECTIONS, CONCEPTS } from "@/lib/fixtures";
import type { GenerateRequestInput } from "@/lib/services/ai-provider";
import type { Collection, Concept, GenerationJob, ID } from "@/lib/types/domain";

export interface JobRecord {
  job: GenerationJob;
  request: GenerateRequestInput;
}

export type SaveResult = { ok: true } | { ok: false; reason: "not_found" | "duplicate" | "forbidden" };

interface StudioState {
  concepts: Concept[];
  collections: Collection[];
  jobs: JobRecord[];
  activeJobId: ID | null;
  toggleFavorite: (id: ID) => void;
  addConcepts: (concepts: Concept[]) => void;
  saveToCollection: (conceptId: ID, collectionId: ID) => SaveResult;
  upsertJob: (record: JobRecord) => void;
  updateJob: (job: GenerationJob) => void;
  setActiveJob: (id: ID | null) => void;
  reset: () => void;
}

const initial = () => ({ concepts: CONCEPTS, collections: COLLECTIONS, jobs: [] as JobRecord[], activeJobId: null });

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      ...initial(),
      toggleFavorite: (id) =>
        set((s) => ({ concepts: s.concepts.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c)) })),
      addConcepts: (incoming) =>
        set((s) => {
          const known = new Set(s.concepts.map((c) => c.id));
          return { concepts: [...s.concepts, ...incoming.filter((c) => !known.has(c.id))] };
        }),
      saveToCollection: (conceptId, collectionId) => {
        const { concepts, collections } = get();
        const concept = concepts.find((c) => c.id === conceptId);
        const collection = collections.find((c) => c.id === collectionId);
        if (!concept || !collection) return { ok: false, reason: "not_found" };
        if (concept.orgId !== collection.orgId) return { ok: false, reason: "forbidden" };
        if (collection.conceptIds.includes(conceptId)) return { ok: false, reason: "duplicate" };
        set({
          collections: collections.map((c) =>
            c.id === collectionId ? { ...c, conceptIds: [...c.conceptIds, conceptId], updatedAt: new Date().toISOString() } : c,
          ),
          concepts: concepts.map((c) => (c.id === conceptId && !c.collectionId ? { ...c, collectionId } : c)),
        });
        return { ok: true };
      },
      upsertJob: (record) =>
        set((s) => ({ jobs: [record, ...s.jobs.filter((r) => r.job.id !== record.job.id)].slice(0, 30) })),
      updateJob: (job) => set((s) => ({ jobs: s.jobs.map((r) => (r.job.id === job.id ? { ...r, job } : r)) })),
      setActiveJob: (activeJobId) => set({ activeJobId }),
      reset: () => set(initial()),
    }),
    {
      name: "raco-studio-v2",
      skipHydration: true,
      partialize: ({ concepts, collections, jobs, activeJobId }) => ({ concepts, collections, jobs, activeJobId }),
    },
  ),
);


/** True once persisted demo state has been restored (after mount). */
export function useStoreHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(useStudioStore.persist.hasHydrated());
    return useStudioStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}
