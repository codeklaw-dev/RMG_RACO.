import { beforeEach, describe, expect, it } from "vitest";
import { CONCEPTS } from "@/lib/fixtures";
import type { Concept } from "@/lib/types/domain";
import { useStudioStore } from "./studio-store";

const generated: Concept = { ...CONCEPTS[0], id: "job_t_c1", jobId: "job_t", collectionId: null, favorite: false };

beforeEach(() => {
  localStorage.clear();
  useStudioStore.getState().reset();
});

describe("studio store", () => {
  it("adds generated concepts once and persists them", () => {
    const { addConcepts } = useStudioStore.getState();
    addConcepts([generated]);
    addConcepts([generated]);
    expect(useStudioStore.getState().concepts.filter((c) => c.id === generated.id)).toHaveLength(1);
    const saved = JSON.parse(localStorage.getItem("raco-studio") ?? "{}");
    expect(saved.state.concepts.some((c: Concept) => c.id === generated.id)).toBe(true);
  });

  it("persists favourites", () => {
    useStudioStore.getState().toggleFavorite(CONCEPTS[1].id);
    const saved = JSON.parse(localStorage.getItem("raco-studio") ?? "{}");
    expect(saved.state.concepts.find((c: Concept) => c.id === CONCEPTS[1].id).favorite).toBe(true);
  });

  it("saves to a collection without duplicates and keeps concept ids", () => {
    const s = useStudioStore.getState();
    s.addConcepts([generated]);
    expect(s.saveToCollection(generated.id, "col_resort")).toEqual({ ok: true });
    expect(useStudioStore.getState().saveToCollection(generated.id, "col_resort")).toEqual({ ok: false, reason: "duplicate" });
    const col = useStudioStore.getState().collections.find((c) => c.id === "col_resort")!;
    expect(col.conceptIds.filter((id) => id === generated.id)).toHaveLength(1);
    expect(useStudioStore.getState().concepts.find((c) => c.id === generated.id)?.collectionId).toBe("col_resort");
  });

  it("refuses unknown collections and cross-organisation saves", () => {
    const s = useStudioStore.getState();
    s.addConcepts([generated, { ...generated, id: "foreign", orgId: "org_other" }]);
    expect(s.saveToCollection(generated.id, "col_missing")).toEqual({ ok: false, reason: "not_found" });
    expect(useStudioStore.getState().saveToCollection("foreign", "col_aw26")).toEqual({ ok: false, reason: "forbidden" });
  });
});

describe("persisted state migration", () => {
  it("migrates a legacy v1 payload, keeping favourites and filling new fields", async () => {
    localStorage.clear();
    const legacy = CONCEPTS.map(({ silhouette, description, provenance, ...c }) => (void silhouette, void description, void provenance, { ...c, favorite: c.id === "cpt_02" }));
    localStorage.setItem("raco-studio-v1", JSON.stringify({ state: { concepts: legacy }, version: 0 }));
    await useStudioStore.persist.rehydrate();
    const s = useStudioStore.getState();
    expect(s.concepts.find((c) => c.id === "cpt_02")?.favorite).toBe(true);
    expect(s.concepts.every((c) => typeof c.silhouette === "string" && typeof c.provenance === "string")).toBe(true);
    expect(s.collections.length).toBeGreaterThan(0);
    expect(localStorage.getItem("raco-studio-v1")).toBeNull();
  });

  it("recovers from a corrupt payload without throwing", async () => {
    localStorage.clear();
    localStorage.setItem("raco-studio", JSON.stringify({ state: { concepts: "nope", collections: [{ id: "col_aw26", conceptIds: ["ghost"] }], jobs: [{}] }, version: 3 }));
    await useStudioStore.persist.rehydrate();
    const s = useStudioStore.getState();
    expect(s.concepts.length).toBe(CONCEPTS.length);
    expect(s.collections.find((c) => c.id === "col_aw26")?.conceptIds).toEqual([]);
    expect(s.jobs).toEqual([]);
  });
});
