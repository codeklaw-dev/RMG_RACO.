"use client";
// Ephemeral Studio UI state: the brief being edited, selection, local references.
// Not persisted — reference previews are object URLs that die with the tab.
import { create } from "zustand";
import { BRAND_PROFILE } from "@/lib/fixtures";
import { DEFAULT_BRIEF, MODE_DEFAULT_CREATIVITY, briefFromConcept, type Brief } from "@/lib/studio/brief";
import type { Concept, DesignMode, ID } from "@/lib/types/domain";

export interface LocalReference {
  id: ID;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
  status: "ready";
  rightsConfirmed: boolean;
}

interface SessionState {
  brief: Brief;
  selectedId: ID | null;
  compareIds: ID[];
  references: LocalReference[];
  viewJobId: ID | null;
  setBrief: (patch: Partial<Brief>) => void;
  setMode: (mode: DesignMode) => void;
  loadVariation: (c: Concept) => void;
  clearVariation: () => void;
  select: (id: ID | null) => void;
  toggleCompare: (id: ID) => void;
  addReferences: (refs: LocalReference[]) => void;
  removeReference: (id: ID) => void;
  /** Revokes every preview object URL and detaches references from the brief. */
  clearReferences: () => void;
  setViewJob: (id: ID | null) => void;
}

export const useStudioSession = create<SessionState>()((set) => ({
  brief: DEFAULT_BRIEF,
  selectedId: null,
  compareIds: [],
  references: [],
  viewJobId: null,
  setBrief: (patch) => set((s) => ({ brief: { ...s.brief, ...patch } })),
  setMode: (mode) =>
    set((s) => ({
      brief: {
        ...s.brief,
        mode,
        creativity: MODE_DEFAULT_CREATIVITY[mode],
        // Brand mode keeps only colours that belong to the brand palette.
        palette: mode === "brand" ? s.brief.palette.filter((h) => BRAND_PROFILE.palette.some((p) => p.hex === h)) : s.brief.palette,
      },
    })),
  loadVariation: (c) => set((s) => ({ brief: briefFromConcept(c, s.brief) })),
  clearVariation: () => set((s) => ({ brief: { ...s.brief, variationOf: null } })),
  select: (selectedId) => set({ selectedId }),
  toggleCompare: (id) =>
    set((s) => ({
      compareIds: s.compareIds.includes(id) ? s.compareIds.filter((x) => x !== id) : [...s.compareIds, id].slice(-2),
    })),
  addReferences: (refs) => set((s) => ({ references: [...s.references, ...refs], brief: { ...s.brief, referenceIds: [...s.brief.referenceIds, ...refs.map((r) => r.id)] } })),
  removeReference: (id) =>
    set((s) => {
      const ref = s.references.find((r) => r.id === id);
      if (ref) URL.revokeObjectURL(ref.previewUrl);
      return { references: s.references.filter((r) => r.id !== id), brief: { ...s.brief, referenceIds: s.brief.referenceIds.filter((x) => x !== id) } };
    }),
  clearReferences: () =>
    set((s) => {
      s.references.forEach((r) => URL.revokeObjectURL(r.previewUrl));
      return { references: [], brief: { ...s.brief, referenceIds: [] } };
    }),
  setViewJob: (viewJobId) => set({ viewJobId }),
}));

// Object URLs pin file data in memory until revoked; release them when the tab is hidden for good.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", (e) => {
    if (!e.persisted) useStudioSession.getState().clearReferences();
  });
}
