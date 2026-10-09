"use client";
// Restores the curated demo dataset across every store.
import { CONCEPTS } from "@/lib/fixtures";
import { BRAND_VERSIONS } from "@/lib/fixtures";
import { DEMO_BRIEFS, DEMO_PREVIEWS, DEMO_VERSIONS } from "@/lib/fixtures/demo";
import { useBrandStore } from "@/lib/store/brand-store";
import { useEditorSession } from "@/lib/store/editor-session";
import { useHandoffStore } from "@/lib/store/handoff-store";
import { useReferenceFiles } from "@/lib/store/reference-files";
import { useStudioSession } from "@/lib/store/studio-session";
import { useStudioStore } from "@/lib/store/studio-store";
import { DEFAULT_BRIEF } from "@/lib/studio/brief";

/** Counts of work that a reset would discard (empty object = nothing custom). */
export function userWorkSummary() {
  const s = useStudioStore.getState();
  const b = useBrandStore.getState();
  const h = useHandoffStore.getState();
  const out: Record<string, number> = {};
  const add = (k: string, n: number) => { if (n > 0) out[k] = n; };
  add("generation jobs", s.jobs.length);
  add("generated or duplicated concepts", s.concepts.length - CONCEPTS.length);
  add("design versions", s.versions.length - CONCEPTS.length - DEMO_VERSIONS.length);
  add("Brand DNA versions", b.versions.length - BRAND_VERSIONS.length);
  add("technical briefs", h.briefs.length - DEMO_BRIEFS.length);
  add("try-on previews", h.previews.length - DEMO_PREVIEWS.length);
  return out;
}

export function resetDemo() {
  useStudioStore.getState().reset();
  useBrandStore.getState().reset();
  useHandoffStore.getState().reset();
  useStudioSession.getState().clearReferences();
  useStudioSession.setState({ brief: DEFAULT_BRIEF, selectedId: null, compareIds: [], viewJobId: null });
  useEditorSession.getState().open(null);
  useReferenceFiles.getState().clear();
}
