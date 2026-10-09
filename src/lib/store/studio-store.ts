"use client";
// Client-side demo state, persisted to localStorage (metadata only — never image data).
// In production this is replaced by server state over /api/v1.
import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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

export const STORE_KEY = "raco-studio";
export const STORE_VERSION = 3;
/** Keys written by earlier builds; read once, migrated, then removed. */
const LEGACY_KEYS = ["raco-studio-v2", "raco-studio-v1"];

type Persisted = Pick<StudioState, "concepts" | "collections" | "jobs" | "activeJobId">;

const FIXTURE_BY_ID = new Map(CONCEPTS.map((c) => [c.id, c]));

/** Fill fields added since older builds; drop records that can't be repaired. */
function normalizeConcept(raw: Partial<Concept>): Concept | null {
  if (!raw?.id || !raw.orgId || !raw.category) return null;
  const fixture = FIXTURE_BY_ID.get(raw.id);
  if (fixture) return { ...fixture, favorite: Boolean(raw.favorite), collectionId: raw.collectionId ?? fixture.collectionId };
  return {
    silhouette: "tailored",
    description: raw.title ?? "",
    parentConceptId: null,
    jobId: null,
    seed: null,
    provenance: "Restored from an earlier demo session · schematic placeholder",
    palette: [],
    fabrics: [],
    favorite: false,
    capability: "simulated",
    ...raw,
  } as Concept;
}

export function migrateState(raw: unknown): Persisted {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Persisted>;
  const concepts = Array.isArray(s.concepts)
    ? s.concepts.map(normalizeConcept).filter((c): c is Concept => c !== null)
    : [...CONCEPTS];
  for (const f of CONCEPTS) if (!concepts.some((c) => c.id === f.id)) concepts.push(f);
  const known = new Set(concepts.map((c) => c.id));
  const saved = Array.isArray(s.collections) ? s.collections : [];
  const collections = COLLECTIONS.map((fixture) => {
    const prev = saved.find((c) => c?.id === fixture.id);
    const ids = Array.isArray(prev?.conceptIds) ? prev.conceptIds : fixture.conceptIds;
    return { ...fixture, conceptIds: [...new Set(ids)].filter((id) => known.has(id)), updatedAt: prev?.updatedAt ?? fixture.updatedAt };
  });
  const jobs = (Array.isArray(s.jobs) ? s.jobs : [])
    .filter((r): r is JobRecord => Boolean(r?.job?.id && r.request))
    .map((r) => ({ ...r, job: { ...r.job, attempt: r.job.attempt ?? 1, stage: r.job.stage ?? null } }));
  const activeJobId = jobs.some((r) => r.job.id === s.activeJobId) ? (s.activeJobId ?? null) : null;
  return { concepts, collections, jobs, activeJobId };
}

const storage = createJSONStorage<Persisted>(() => ({
  getItem: (name) => {
    const current = localStorage.getItem(name);
    if (current) return current;
    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy) {
        LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
        // Legacy payloads had no version; mark as 0 so migrate() runs.
        const parsed = JSON.parse(legacy);
        return JSON.stringify({ state: parsed.state ?? {}, version: 0 });
      }
    }
    return null;
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
}));

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
      name: STORE_KEY,
      version: STORE_VERSION,
      storage,
      skipHydration: true,
      migrate: (persisted) => migrateState(persisted),
      // Same-version payloads are still validated so a hand-edited or corrupt entry can't break the UI.
      merge: (persisted, current) => ({ ...current, ...migrateState(persisted) }),
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
