"use client";
// Brand DNA state: versions, reference metadata and change log. Persisted
// (metadata only). All version transitions go through lib/brand/versioning.
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { persist } from "zustand/middleware";
import { approvedVersion, workingVersion } from "@/lib/brand/versioning";
import { isReferenceEligible } from "@/lib/brand/intelligence";
import { referenceAvailable, useReferenceFiles } from "./reference-files";
import { approve, discardDraft, editDraft, restoreAsDraft, returnToDraft, submitForReview, VersionError } from "@/lib/brand/versioning";
import { BRAND_REFERENCES, BRAND_VERSIONS } from "@/lib/fixtures";
import type { ID } from "@/lib/types/domain";
import type { BrandChange, BrandDNA, BrandProfileVersion, BrandReference } from "@/lib/types/brand";

export const SIMULATED_APPROVER = "Amara Okafor (simulated approval)";

export type ActionResult = { ok: true } | { ok: false; error: string };

interface BrandState {
  versions: BrandProfileVersion[];
  references: BrandReference[];
  changes: BrandChange[];
  edit: (summary: string, fn: (c: BrandDNA) => BrandDNA) => ActionResult;
  submit: () => ActionResult;
  returnToDraft: () => ActionResult;
  approve: () => ActionResult;
  discard: () => ActionResult;
  restore: (version: number) => ActionResult;
  addReference: (r: BrandReference) => void;
  updateReference: (id: ID, patch: Partial<BrandReference>) => void;
  removeReference: (id: ID) => void;
  reset: () => void;
}

const initial = () => ({ versions: BRAND_VERSIONS, references: BRAND_REFERENCES, changes: [] as BrandChange[] });
let seq = 0;
const change = (version: number, action: BrandChange["action"], summary: string): BrandChange => ({
  id: `chg_${Date.now().toString(36)}_${++seq}`,
  at: new Date().toISOString(),
  version,
  action,
  summary,
});

export const useBrandStore = create<BrandState>()(
  persist(
    (set, get) => {
      /** Run a pure version transition; convert workflow errors to results. */
      const run = (fn: (vs: BrandProfileVersion[]) => { versions: BrandProfileVersion[]; log: BrandChange[] }): ActionResult => {
        try {
          const { versions, log } = fn(get().versions);
          set((s) => ({ versions, changes: [...log, ...s.changes].slice(0, 50) }));
          return { ok: true };
        } catch (e) {
          if (e instanceof VersionError) return { ok: false, error: e.message };
          throw e;
        }
      };
      const find = (vs: BrandProfileVersion[], status: BrandProfileVersion["status"]) => vs.find((v) => v.status === status)!;
      return {
        ...initial(),
        edit: (summary, fn) =>
          run((vs) => {
            const { versions, draft, created } = editDraft(vs, fn);
            const log = [change(draft.version, "edited", summary)];
            if (created) log.push(change(draft.version, "created_draft", `Draft v${draft.version} created from v${draft.basedOnVersion}`));
            return { versions, log };
          }),
        submit: () => run((vs) => { const versions = submitForReview(vs); const v = find(versions, "in_review"); return { versions, log: [change(v.version, "submitted", `v${v.version} submitted for review`)] }; }),
        returnToDraft: () => run((vs) => { const versions = returnToDraft(vs); const v = find(versions, "draft"); return { versions, log: [change(v.version, "returned", `v${v.version} returned to draft`)] }; }),
        approve: () =>
          run((vs) => {
            const versions = approve(vs, SIMULATED_APPROVER);
            const v = find(versions, "approved");
            return { versions, log: [change(v.version, "approved", `v${v.version} approved (simulated)`)] };
          }),
        discard: () => run((vs) => { const d = find(vs, "draft"); return { versions: discardDraft(vs), log: [change(d.version, "discarded", `Draft v${d.version} discarded`)] }; }),
        restore: (version) =>
          run((vs) => {
            const { versions, draft } = restoreAsDraft(vs, version);
            return { versions, log: [change(draft.version, "restored", `Draft v${draft.version} restored from v${version}`)] };
          }),
        addReference: (r) => set((s) => ({ references: [r, ...s.references] })),
        updateReference: (id, patch) => set((s) => ({ references: s.references.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
        removeReference: (id) => set((s) => ({ references: s.references.filter((r) => r.id !== id) })),
        reset: () => set(initial()),
      };
    },
    {
      name: "raco-brand",
      version: 1,
      skipHydration: true,
      partialize: ({ versions, references, changes }) => ({ versions, references, changes }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<BrandState>;
        const valid = Array.isArray(p.versions) && p.versions.length > 0 && p.versions.every((v) => v?.content?.rules && v.status);
        return {
          ...current,
          versions: valid ? p.versions! : current.versions,
          references: Array.isArray(p.references) ? p.references : current.references,
          changes: Array.isArray(p.changes) ? p.changes : current.changes,
        };
      },
    },
  ),
);


export const useApprovedVersion = () => useBrandStore((s) => approvedVersion(s.versions));
export const useWorkingVersion = () => useBrandStore((s) => workingVersion(s.versions));

/** Ids of approved references whose image (or demo placeholder) is available in this tab. */
export function useEligibleReferenceIds() {
  const urls = useReferenceFiles((s) => s.urls);
  return useBrandStore(useShallow((s) => s.references.filter((r) => isReferenceEligible(r, () => referenceAvailable(r, urls))).map((r) => r.id)));
}
