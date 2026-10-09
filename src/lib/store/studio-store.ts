"use client";
// Client-side demo state, persisted to localStorage (metadata only — never image data).
// In production this is replaced by server state over /api/v1. Every mutation
// validates referential integrity and organisation scope before writing.
import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { nextVersion, originalVersion, versionsOf } from "@/lib/editor/versions";
import { reviewTransition, type ReviewAction } from "@/lib/editor/review";
import { clamp01 } from "@/lib/editor/annotations";
import { COLLECTIONS, CONCEPTS } from "@/lib/fixtures";
import { DEMO_ANNOTATIONS, DEMO_HEAD, DEMO_REVIEWS, DEMO_VERSIONS } from "@/lib/fixtures/demo";
import type { GenerateRequestInput } from "@/lib/services/ai-provider";
import type {
  BrandException,
  Collection,
  CollectionStatus,
  Concept,
  ConceptSnapshot,
  ConceptVersion,
  DesignAnnotation,
  DesignReview,
  GenerationJob,
  ID,
  LookMeta,
} from "@/lib/types/domain";

export { snapshotOf } from "@/lib/editor/versions";

export interface JobRecord {
  job: GenerationJob;
  request: GenerateRequestInput;
}

export type SaveResult = { ok: true } | { ok: false; reason: "not_found" | "duplicate" | "forbidden" };
export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

export const SIMULATED_REVIEWER = "Amara Okafor (simulated)";

const mirror = (c: Concept, v: ConceptVersion): Concept => ({ ...c, ...v.snapshot, currentVersionId: v.id });
const now = () => new Date().toISOString();
let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(++seq).toString(36)}`;
const fail = <T,>(error: string): Result<T> => ({ ok: false, error });

interface StudioState {
  concepts: Concept[];
  versions: ConceptVersion[];
  annotations: DesignAnnotation[];
  reviews: DesignReview[];
  exceptions: BrandException[];
  collections: Collection[];
  jobs: JobRecord[];
  activeJobId: ID | null;
  toggleFavorite: (id: ID) => void;
  addConcepts: (concepts: Concept[]) => void;
  saveToCollection: (conceptId: ID, collectionId: ID) => SaveResult;
  upsertJob: (record: JobRecord) => void;
  updateJob: (job: GenerationJob) => void;
  setActiveJob: (id: ID | null) => void;
  // ── Versions (immutable; every change appends) ──
  /** Append a refinement result produced by the provider. */
  addVersion: (v: ConceptVersion) => Result<ID>;
  /** Save edited properties as a new version on top of the current head. */
  saveRevision: (conceptId: ID, snapshot: ConceptSnapshot, note?: string) => Result<ID>;
  /** Copy an earlier version into a new head version. History is untouched. */
  restoreVersion: (conceptId: ID, versionId: ID) => Result<ID>;
  /** Variation = new related concept (not a revision). Returns the new concept id. */
  duplicateFromVersion: (conceptId: ID, versionId: ID) => ID | null;
  // ── Annotations ──
  addAnnotation: (a: Pick<DesignAnnotation, "conceptId" | "versionId" | "x" | "y" | "text" | "category" | "view">) => Result<ID>;
  updateAnnotation: (id: ID, patch: Partial<Pick<DesignAnnotation, "x" | "y" | "text" | "category" | "resolved">>) => void;
  deleteAnnotation: (id: ID) => void;
  // ── Concept review ──
  review: (conceptId: ID, action: ReviewAction, note?: string) => Result<ID | null>;
  addException: (e: Omit<BrandException, "id" | "at">) => Result<ID>;
  removeException: (id: ID) => void;
  // ── Collections ──
  reorderLooks: (collectionId: ID, orderedIds: ID[]) => void;
  moveLook: (collectionId: ID, conceptId: ID, delta: number) => void;
  removeFromCollection: (collectionId: ID, conceptId: ID) => void;
  setLookMeta: (collectionId: ID, conceptId: ID, patch: Partial<LookMeta>) => void;
  updateCollection: (collectionId: ID, patch: Partial<Pick<Collection, "name" | "description" | "creativeDirection" | "notes">>) => void;
  addGroup: (collectionId: ID, name: string) => Result<ID>;
  renameGroup: (collectionId: ID, groupId: ID, name: string) => void;
  removeGroup: (collectionId: ID, groupId: ID) => void;
  setCollectionStatus: (collectionId: ID, status: CollectionStatus) => void;
  reset: () => void;
}

export const STORE_KEY = "raco-studio";
export const STORE_VERSION = 5;
/** Keys written by earlier builds; read once, migrated, then removed. */
const LEGACY_KEYS = ["raco-studio-v2", "raco-studio-v1"];

type Persisted = Pick<StudioState, "concepts" | "versions" | "annotations" | "reviews" | "exceptions" | "collections" | "jobs" | "activeJobId">;

const FIXTURE_BY_ID = new Map(CONCEPTS.map((c) => [c.id, c]));
const LEGACY_STATUS: Record<string, Concept["status"]> = { shortlisted: "in_review" };

/** Fill fields added since older builds; drop records that can't be repaired. */
function normalizeConcept(raw: Partial<Concept>): Concept | null {
  if (!raw?.id || !raw.orgId || !raw.category) return null;
  const defaults: Partial<Concept> = FIXTURE_BY_ID.get(raw.id) ?? {
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
  };
  const c = { ...defaults, ...raw } as Concept;
  return { ...c, status: LEGACY_STATUS[c.status as string] ?? c.status ?? "draft" };
}

const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

export function migrateState(raw: unknown): Persisted {
  const s = (raw && typeof raw === "object" ? raw : {}) as Partial<Persisted>;
  const concepts = Array.isArray(s.concepts) ? s.concepts.map(normalizeConcept).filter((c): c is Concept => c !== null) : [...CONCEPTS];
  for (const f of CONCEPTS) if (!concepts.some((c) => c.id === f.id)) concepts.push(f);
  const known = new Set(concepts.map((c) => c.id));
  const saved = arr<Collection>(s.collections);
  const collections = COLLECTIONS.map((fixture) => {
    const prev = saved.find((c) => c?.id === fixture.id);
    const ids = Array.isArray(prev?.conceptIds) ? prev.conceptIds : fixture.conceptIds;
    return {
      ...fixture,
      ...(prev ? { name: prev.name ?? fixture.name, description: prev.description ?? fixture.description, status: prev.status ?? fixture.status } : {}),
      conceptIds: [...new Set(ids)].filter((id) => known.has(id)),
      lookMeta: prev?.lookMeta ?? fixture.lookMeta ?? {},
      creativeDirection: prev?.creativeDirection ?? fixture.creativeDirection ?? "",
      notes: prev?.notes ?? fixture.notes ?? "",
      groups: prev?.groups ?? fixture.groups ?? [],
      updatedAt: prev?.updatedAt ?? fixture.updatedAt,
    };
  });
  const jobs = arr<JobRecord>(s.jobs)
    .filter((r) => Boolean(r?.job?.id && r.request))
    .map((r) => ({ ...r, job: { ...r.job, attempt: r.job.attempt ?? 1, stage: r.job.stage ?? null } }));
  const activeJobId = jobs.some((r) => r.job.id === s.activeJobId) ? (s.activeJobId ?? null) : null;
  // v4/v5: version history. Keep valid stored versions; backfill numbers; give every concept its original.
  const versions = arr<ConceptVersion>(s.versions)
    .filter((v) => Boolean(v?.id && v.snapshot && known.has(v.conceptId)))
    .map((v, i, all) => ({
      ...v,
      number: v.number ?? all.filter((x) => x.conceptId === v.conceptId).indexOf(v) + 1,
      summary: v.summary ?? (v.parentId ? "Revision" : "Original"),
      brandProfileVersion: v.brandProfileVersion ?? concepts.find((c) => c.id === v.conceptId)?.brandProfileVersion ?? null,
      provenance: v.provenance ?? "Migrated from an earlier demo session",
    }));
  for (const c of concepts) if (!versions.some((v) => v.conceptId === c.id && v.parentId === null)) versions.push(originalVersion(c));
  const fixed = concepts.map((c) => (versions.some((v) => v.id === c.currentVersionId) ? c : { ...c, currentVersionId: `${c.id}_v1` }));
  const versionIds = new Set(versions.map((v) => v.id));
  return {
    concepts: fixed,
    versions,
    annotations: arr<DesignAnnotation>(s.annotations).filter((a) => versionIds.has(a?.versionId)),
    reviews: arr<DesignReview>(s.reviews).filter((r) => known.has(r?.conceptId)),
    exceptions: arr<BrandException>(s.exceptions).filter((e) => versionIds.has(e?.versionId)),
    collections,
    jobs,
    activeJobId,
  };
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

/** Clean-session state: base fixtures + curated demo history (versions, notes, reviews). */
const initial = (): Persisted => ({
  concepts: CONCEPTS.map((c) => {
    const head = DEMO_VERSIONS.find((v) => v.id === DEMO_HEAD[c.id]);
    return head ? mirror(c, head) : c;
  }),
  versions: [...CONCEPTS.map(originalVersion), ...DEMO_VERSIONS],
  annotations: DEMO_ANNOTATIONS,
  reviews: DEMO_REVIEWS,
  exceptions: [],
  collections: COLLECTIONS,
  jobs: [],
  activeJobId: null,
});

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => {
      const concept = (id: ID) => get().concepts.find((c) => c.id === id);
      const collection = (id: ID) => get().collections.find((c) => c.id === id);
      const patchCollection = (id: ID, fn: (c: Collection) => Collection) =>
        set((s) => ({ collections: s.collections.map((c) => (c.id === id ? { ...fn(c), updatedAt: now() } : c)) }));
      /** Append a version and make it the head. Rejects anything that would rewrite history. */
      const append = (v: ConceptVersion): Result<ID> => {
        const { versions } = get();
        const c = concept(v.conceptId);
        if (!c) return fail("Concept not found");
        if (versions.some((x) => x.id === v.id)) return fail("Version already exists");
        if (v.parentId && !versions.some((x) => x.id === v.parentId && x.conceptId === v.conceptId)) return fail("Parent version not found");
        set((s) => ({ versions: [...s.versions, v], concepts: s.concepts.map((x) => (x.id === c.id ? mirror(x, v) : x)) }));
        return { ok: true, value: v.id };
      };

      return {
        ...initial(),
        toggleFavorite: (id) => set((s) => ({ concepts: s.concepts.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c)) })),
        addConcepts: (incoming) =>
          set((s) => {
            const known = new Set(s.concepts.map((c) => c.id));
            const fresh = incoming.filter((c) => !known.has(c.id));
            return { concepts: [...s.concepts, ...fresh], versions: [...s.versions, ...fresh.map(originalVersion)] };
          }),
        saveToCollection: (conceptId, collectionId) => {
          const c = concept(conceptId);
          const col = collection(collectionId);
          if (!c || !col) return { ok: false, reason: "not_found" };
          if (c.orgId !== col.orgId) return { ok: false, reason: "forbidden" };
          if (col.conceptIds.includes(conceptId)) return { ok: false, reason: "duplicate" };
          set((s) => ({
            collections: s.collections.map((x) => (x.id === collectionId ? { ...x, conceptIds: [...x.conceptIds, conceptId], updatedAt: now() } : x)),
            concepts: s.concepts.map((x) => (x.id === conceptId && !x.collectionId ? { ...x, collectionId } : x)),
          }));
          return { ok: true };
        },
        upsertJob: (record) => set((s) => ({ jobs: [record, ...s.jobs.filter((r) => r.job.id !== record.job.id)].slice(0, 30) })),
        updateJob: (job) => set((s) => ({ jobs: s.jobs.map((r) => (r.job.id === job.id ? { ...r, job } : r)) })),
        setActiveJob: (activeJobId) => set({ activeJobId }),

        addVersion: (v) => {
          const c = concept(v.conceptId);
          if (!c) return fail("Concept not found");
          // Provider results carry their own id; renumber onto this concept's sequence.
          const own = versionsOf(get().versions, c.id);
          return append({ ...v, number: (own[own.length - 1]?.number ?? 0) + 1, brandProfileVersion: c.brandProfileVersion });
        },
        saveRevision: (conceptId, snapshot, note) => {
          const c = concept(conceptId);
          if (!c) return fail("Concept not found");
          if (c.status === "approved" || c.status === "archived") return fail("Approved and archived concepts are locked. Reopen or duplicate to change them.");
          const v = nextVersion(get().versions, c, { operation: "manual", snapshot, instruction: note ?? "Designer edit" });
          if (!v.changes.length) return fail("No changes to save");
          return append(v);
        },
        restoreVersion: (conceptId, versionId) => {
          const c = concept(conceptId);
          const source = get().versions.find((v) => v.id === versionId && v.conceptId === conceptId);
          if (!c || !source) return fail("Version not found");
          if (source.id === c.currentVersionId) return fail("That version is already current");
          return append(nextVersion(get().versions, c, { operation: "restore", snapshot: source.snapshot, instruction: `Restore v${source.number}`, summary: `Restored v${source.number}` }));
        },
        duplicateFromVersion: (conceptId, versionId) => {
          const { concepts, versions } = get();
          const source = concepts.find((c) => c.id === conceptId);
          const v = versions.find((x) => x.id === versionId && x.conceptId === conceptId);
          if (!source || !v) return null;
          const n = concepts.filter((c) => c.parentConceptId === conceptId && c.id.includes("_var")).length + 1;
          const id = `${conceptId}_var${n}`;
          const copy: Concept = {
            ...source,
            ...v.snapshot,
            id,
            title: `${v.snapshot.title.replace(/ \(variation.*\)$/, "")} (variation ${n})`,
            collectionId: null,
            favorite: false,
            status: "draft",
            parentConceptId: conceptId,
            currentVersionId: `${id}_v1`,
            provenance: `Variation of ${source.title} v${v.number} · ${source.provenance}`,
            createdAt: now(),
          };
          set({ concepts: [...concepts, copy], versions: [...versions, originalVersion(copy)] });
          return id;
        },

        addAnnotation: (a) => {
          const c = concept(a.conceptId);
          if (!c || !get().versions.some((v) => v.id === a.versionId && v.conceptId === a.conceptId)) return fail("Version not found");
          if (!a.text.trim()) return fail("Write a comment");
          const id = uid("ann");
          set((s) => ({
            annotations: [...s.annotations, { ...a, id, orgId: c.orgId, x: clamp01(a.x), y: clamp01(a.y), text: a.text.trim(), resolved: false, createdAt: now(), updatedAt: now() }],
          }));
          return { ok: true, value: id };
        },
        updateAnnotation: (id, patch) =>
          set((s) => ({
            annotations: s.annotations.map((a) =>
              a.id === id ? { ...a, ...patch, ...(patch.x !== undefined ? { x: clamp01(patch.x) } : {}), ...(patch.y !== undefined ? { y: clamp01(patch.y) } : {}), updatedAt: now() } : a,
            ),
          })),
        deleteAnnotation: (id) => set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) })),

        review: (conceptId, action, note = "") => {
          const c = concept(conceptId);
          if (!c) return fail("Concept not found");
          let to: Concept["status"];
          try {
            to = reviewTransition(c.status, action);
          } catch (e) {
            return fail((e as Error).message);
          }
          let versionId = c.currentVersionId;
          // Reopening starts a fresh draft version so the rejected one stays on record.
          if (action === "reopen") {
            const head = get().versions.find((v) => v.id === c.currentVersionId)!;
            const res = append(nextVersion(get().versions, c, { operation: "reopen", snapshot: head.snapshot, instruction: note || "Reopened after review", summary: "Reopened as draft" }));
            if (!res.ok) return res;
            versionId = res.value;
          }
          const r: DesignReview = { id: uid("rev"), conceptId, versionId, from: c.status, to, note: note.trim(), actor: SIMULATED_REVIEWER, at: now() };
          set((s) => ({ reviews: [r, ...s.reviews], concepts: s.concepts.map((x) => (x.id === conceptId ? { ...x, status: to } : x)) }));
          return { ok: true, value: action === "reopen" ? versionId : null };
        },
        addException: (e) => {
          if (!e.reason.trim()) return fail("A reason is required");
          if (!get().versions.some((v) => v.id === e.versionId && v.conceptId === e.conceptId)) return fail("Version not found");
          const id = uid("exc");
          set((s) => ({ exceptions: [...s.exceptions.filter((x) => !(x.versionId === e.versionId && x.ruleId === e.ruleId)), { ...e, reason: e.reason.trim(), id, at: now() }] }));
          return { ok: true, value: id };
        },
        removeException: (id) => set((s) => ({ exceptions: s.exceptions.filter((x) => x.id !== id) })),

        reorderLooks: (collectionId, orderedIds) =>
          patchCollection(collectionId, (c) =>
            // Only accept a permutation of the current looks.
            orderedIds.length === c.conceptIds.length && orderedIds.every((id) => c.conceptIds.includes(id)) ? { ...c, conceptIds: orderedIds } : c,
          ),
        moveLook: (collectionId, conceptId, delta) =>
          patchCollection(collectionId, (c) => {
            const ids = [...c.conceptIds];
            const i = ids.indexOf(conceptId);
            const j = i + delta;
            if (i < 0 || j < 0 || j >= ids.length) return c;
            [ids[i], ids[j]] = [ids[j], ids[i]];
            return { ...c, conceptIds: ids };
          }),
        removeFromCollection: (collectionId, conceptId) => {
          patchCollection(collectionId, (c) => ({ ...c, conceptIds: c.conceptIds.filter((id) => id !== conceptId) }));
          set((s) => ({ concepts: s.concepts.map((c) => (c.id === conceptId && c.collectionId === collectionId ? { ...c, collectionId: null } : c)) }));
        },
        setLookMeta: (collectionId, conceptId, patch) =>
          patchCollection(collectionId, (c) => {
            if (!c.conceptIds.includes(conceptId)) return c;
            const prev = c.lookMeta?.[conceptId] ?? { note: "", tags: [] };
            return { ...c, lookMeta: { ...c.lookMeta, [conceptId]: { ...prev, ...patch } } };
          }),
        updateCollection: (collectionId, patch) => patchCollection(collectionId, (c) => ({ ...c, ...patch })),
        addGroup: (collectionId, name) => {
          if (!name.trim()) return fail("Name the group");
          if (!collection(collectionId)) return fail("Collection not found");
          const id = uid("grp");
          patchCollection(collectionId, (c) => ({ ...c, groups: [...(c.groups ?? []), { id, name: name.trim() }] }));
          return { ok: true, value: id };
        },
        renameGroup: (collectionId, groupId, name) =>
          patchCollection(collectionId, (c) => ({ ...c, groups: (c.groups ?? []).map((g) => (g.id === groupId && name.trim() ? { ...g, name: name.trim() } : g)) })),
        removeGroup: (collectionId, groupId) =>
          patchCollection(collectionId, (c) => ({
            ...c,
            groups: (c.groups ?? []).filter((g) => g.id !== groupId),
            lookMeta: Object.fromEntries(Object.entries(c.lookMeta ?? {}).map(([k, m]) => [k, m.groupId === groupId ? { ...m, groupId: null } : m])),
          })),
        setCollectionStatus: (collectionId, status) => patchCollection(collectionId, (c) => ({ ...c, status })),
        reset: () => set(initial()),
      };
    },
    {
      name: STORE_KEY,
      version: STORE_VERSION,
      storage,
      skipHydration: true,
      migrate: (persisted) => migrateState(persisted),
      // Same-version payloads are still validated so a hand-edited or corrupt entry can't break the UI.
      merge: (persisted, current) => ({ ...current, ...migrateState(persisted) }),
      partialize: ({ concepts, versions, annotations, reviews, exceptions, collections, jobs, activeJobId }) => ({
        concepts, versions, annotations, reviews, exceptions, collections, jobs, activeJobId,
      }),
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
