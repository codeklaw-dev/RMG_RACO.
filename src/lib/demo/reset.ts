"use client";
// Restores the curated demo dataset across every store, and reports exactly
// what a reset would discard: added, modified and removed records per area.
import { useBrandStore, curatedBrandState } from "@/lib/store/brand-store";
import { useEditorSession } from "@/lib/store/editor-session";
import { useHandoffStore, curatedHandoffState } from "@/lib/store/handoff-store";
import { useReferenceFiles } from "@/lib/store/reference-files";
import { useStudioSession } from "@/lib/store/studio-session";
import { curatedStudioState, migrateState, useStudioStore } from "@/lib/store/studio-store";
import { DEFAULT_BRIEF } from "@/lib/studio/brief";

export interface ResetItem {
  area: string;
  added: number;
  modified: number;
  removed: number;
  /** Up to three human-readable names of affected records. */
  examples: string[];
}

/** Key-order-insensitive deep equality for plain JSON data. */
export function sameData(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(norm) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

function diff<T extends { id: string }>(area: string, baseline: T[], current: T[], name: (r: T) => string): ResetItem | null {
  const base = new Map(baseline.map((r) => [r.id, r]));
  const cur = new Map(current.map((r) => [r.id, r]));
  const added = current.filter((r) => !base.has(r.id));
  const removed = baseline.filter((r) => !cur.has(r.id));
  const modified = current.filter((r) => base.has(r.id) && !sameData(base.get(r.id), r));
  if (!added.length && !removed.length && !modified.length) return null;
  const examples = [...modified, ...added, ...removed].slice(0, 3).map(name);
  return { area, added: added.length, modified: modified.length, removed: removed.length, examples };
}

/** Everything a reset would replace. Empty array = browser holds only curated data. */
export function resetImpact(): ResetItem[] {
  const studio = useStudioStore.getState();
  // Compare both sides after the same normalisation the store applies on load.
  const base = migrateState(curatedStudioState());
  const cur = migrateState({ ...studio, demoSeeded: true });
  const title = (id: string) => cur.concepts.find((c) => c.id === id)?.title ?? base.concepts.find((c) => c.id === id)?.title ?? id;
  const brandBase = curatedBrandState();
  const brand = useBrandStore.getState();
  const handoffBase = curatedHandoffState();
  const handoff = useHandoffStore.getState();
  const jobs = studio.jobs.map((r) => ({ ...r, id: r.job.id }));
  return [
    diff("Concepts", base.concepts, cur.concepts, (c) => c.title),
    diff("Design versions", base.versions, cur.versions, (v) => `${title(v.conceptId)} v${v.number}`),
    diff("Annotations", base.annotations, cur.annotations, (a) => `“${a.text.slice(0, 40)}”`),
    diff("Review records", base.reviews, cur.reviews, (r) => `${title(r.conceptId)}: ${r.to.replace("_", " ")}`),
    diff("Brand exceptions", base.exceptions, cur.exceptions, (e) => `${title(e.conceptId)} · ${e.ruleId}`),
    diff("Collection boards", base.collections, cur.collections, (c) => c.name),
    diff("Generation jobs", [], jobs, (r) => r.request.prompt.slice(0, 40)),
    diff("Brand DNA versions", brandBase.versions, brand.versions, (v) => `v${v.version} (${v.status.replace("_", " ")})`),
    diff("Brand references", brandBase.references, brand.references, (r) => r.title),
    diff("Technical briefs", handoffBase.briefs, handoff.briefs, (b) => `${title(b.conceptId)} v${b.versionNumber}`),
    diff("Try-on previews", handoffBase.previews, handoff.previews, (p) => `${p.garment.title} (${p.pose.replace("_", "-")})`),
  ].filter((x): x is ResetItem => x !== null);
}

export const describeImpact = (i: ResetItem) =>
  [i.added && `${i.added} added`, i.modified && `${i.modified} modified`, i.removed && `${i.removed} removed`].filter(Boolean).join(", ");

export function resetDemo() {
  useStudioStore.getState().reset();
  useBrandStore.getState().reset();
  useHandoffStore.getState().reset();
  useStudioSession.getState().clearReferences();
  useStudioSession.setState({ brief: DEFAULT_BRIEF, selectedId: null, compareIds: [], viewJobId: null });
  useEditorSession.getState().open(null);
  useReferenceFiles.getState().clear();
}
