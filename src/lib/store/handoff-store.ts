"use client";
// Try-on previews and technical briefs. Persisted metadata only (previews are
// re-drawn from schematic data; no images are stored).
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createBrief, isBriefEditable, techTransition, validateMeasurement, type TechAction } from "@/lib/handoff/technical";
import { DEMO_BRIEFS, DEMO_PREVIEWS } from "@/lib/fixtures/demo";
import type { ID } from "@/lib/types/domain";
import type { TechBrief, TryOnPreview } from "@/lib/types/handoff";
import { useStudioStore } from "./studio-store";

export const SIMULATED_TECH_REVIEWER = "Technical lead (simulated role)";
type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };
const fail = <T,>(error: string): Result<T> => ({ ok: false, error });

interface HandoffState {
  previews: TryOnPreview[];
  briefs: TechBrief[];
  addPreview: (p: TryOnPreview) => Result<ID>;
  setPreviewSaved: (id: ID, saved: boolean) => void;
  removePreview: (id: ID) => void;
  createBrief: (conceptId: ID, versionId: ID, orgId: ID) => Result<ID>;
  updateBrief: (id: ID, fn: (b: TechBrief) => TechBrief) => Result<ID>;
  techReview: (id: ID, action: TechAction, note?: string) => Result<ID>;
  reset: () => void;
}

const initial = () => ({ previews: DEMO_PREVIEWS, briefs: DEMO_BRIEFS });

export const useHandoffStore = create<HandoffState>()(
  persist(
    (set, get) => ({
      ...initial(),
      addPreview: (p) => {
        const { versions, concepts } = useStudioStore.getState();
        const concept = concepts.find((c) => c.id === p.conceptId);
        const version = versions.find((v) => v.id === p.versionId && v.conceptId === p.conceptId);
        if (!concept || !version) return fail("Garment version not found");
        if (concept.orgId !== p.orgId) return fail("Garment belongs to another organisation");
        if (get().previews.some((x) => x.id === p.id)) return fail("Preview already exists");
        set((s) => ({ previews: [{ ...p, versionNumber: version.number }, ...s.previews].slice(0, 40) }));
        return { ok: true, value: p.id };
      },
      setPreviewSaved: (id, saved) => set((s) => ({ previews: s.previews.map((p) => (p.id === id ? { ...p, saved } : p)) })),
      removePreview: (id) => set((s) => ({ previews: s.previews.filter((p) => p.id !== id) })),
      createBrief: (conceptId, versionId, orgId) => {
        const { versions, concepts } = useStudioStore.getState();
        const concept = concepts.find((c) => c.id === conceptId);
        const version = versions.find((v) => v.id === versionId && v.conceptId === conceptId);
        if (!concept || !version) return fail("Concept version not found");
        if (concept.orgId !== orgId) return fail("Concept belongs to another organisation");
        const existing = get().briefs.find((b) => b.versionId === versionId);
        if (existing) return { ok: true, value: existing.id };
        const b = createBrief(concept, version);
        set((s) => ({ briefs: [b, ...s.briefs] }));
        return { ok: true, value: b.id };
      },
      updateBrief: (id, fn) => {
        const b = get().briefs.find((x) => x.id === id);
        if (!b) return fail("Brief not found");
        if (!isBriefEditable(b.status)) return fail("Briefs in technical review are locked. Request changes or reopen to edit.");
        const next = fn(structuredClone(b));
        const bad = next.measurements.map(validateMeasurement).find(Boolean);
        if (bad) return fail(bad);
        set((s) => ({ briefs: s.briefs.map((x) => (x.id === id ? { ...next, id, conceptId: b.conceptId, versionId: b.versionId, orgId: b.orgId, status: b.status, reviews: b.reviews, updatedAt: new Date().toISOString() } : x)) }));
        return { ok: true, value: id };
      },
      techReview: (id, action, note = "") => {
        const b = get().briefs.find((x) => x.id === id);
        if (!b) return fail("Brief not found");
        let to;
        try { to = techTransition(b.status, action); } catch (e) { return fail((e as Error).message); }
        const r = { id: `trev_${Date.now().toString(36)}_${b.reviews.length}`, from: b.status, to, note: note.trim(), actor: SIMULATED_TECH_REVIEWER, at: new Date().toISOString() };
        set((s) => ({ briefs: s.briefs.map((x) => (x.id === id ? { ...x, status: to, reviews: [r, ...x.reviews], updatedAt: r.at } : x)) }));
        return { ok: true, value: id };
      },
      reset: () => set(initial()),
    }),
    {
      name: "raco-handoff",
      version: 1,
      skipHydration: true,
      partialize: ({ previews, briefs }) => ({ previews, briefs }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<HandoffState>;
        return {
          ...current,
          previews: Array.isArray(p.previews) ? p.previews.filter((x) => x?.id && x.garment?.palette) : current.previews,
          briefs: Array.isArray(p.briefs) ? p.briefs.filter((x) => x?.id && x.construction && Array.isArray(x.measurements)) : current.briefs,
        };
      },
    },
  ),
);
