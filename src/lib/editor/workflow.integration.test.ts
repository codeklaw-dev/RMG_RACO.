// Studio → Editor → Collection, through the real adapter, engine, interpreter and stores.
import { beforeEach, describe, expect, it } from "vitest";
import { evaluateConcept } from "@/lib/brand/intelligence";
import { BRAND_PROFILE, ORG } from "@/lib/fixtures";
import { DURATION_MS, DemoAIAdapter, QUEUE_MS } from "@/lib/services/demo-adapter";
import { DEFAULT_BRIEF, buildGenerateRequest, strictnessFor } from "@/lib/studio/brief";
import { useStudioStore } from "@/lib/store/studio-store";
import { presentationStep } from "./collections";
import { versionsOf } from "./versions";

let clock = 2_000_000;
const st = () => useStudioStore.getState();

beforeEach(() => {
  localStorage.clear();
  st().reset();
});

describe("acceptance scenario: designing a Serein Atelier collection", () => {
  it("generates, refines, saves, reviews and presents without overwriting history", async () => {
    const adapter = new DemoAIAdapter(() => clock);
    // 1–2. Generate four tailored concepts in Brand mode.
    const brief = { ...DEFAULT_BRIEF, prompt: "Tailored wool blazer for AW26", category: "tailoring" as const, silhouette: "tailored" as const, mode: "brand" as const, brandStrictness: strictnessFor("brand"), count: 4 };
    const { jobId } = await adapter.generateConcepts(buildGenerateRequest(brief, { orgId: ORG.id, brand: BRAND_PROFILE, idempotencyKey: "key_accept_1" }));
    clock += QUEUE_MS + DURATION_MS.generate;
    await adapter.getJob(jobId);
    const results = await adapter.getResults(jobId);
    expect(results).toHaveLength(4);
    st().addConcepts(results);

    // 3–5. Select one, annotate v1.
    const concept = results[0];
    const v1 = versionsOf(st().versions, concept.id)[0];
    expect(st().addAnnotation({ conceptId: concept.id, versionId: v1.id, x: 0.32, y: 0.18, text: "Narrower shoulder", category: "fit", view: "front" }).ok).toBe(true);

    // 6–7. Change silhouette and fabric via a refinement job → new version.
    const head = st().versions.find((v) => v.id === st().concepts.find((c) => c.id === concept.id)!.currentVersionId)!;
    const edit = await adapter.editConcept({ orgId: ORG.id, conceptId: concept.id, parentVersionId: head.id, instruction: "Make it fitted in linen instead of wool", base: head.snapshot, idempotencyKey: "key_accept_2" });
    clock += QUEUE_MS + DURATION_MS.edit;
    await adapter.getJob(edit.jobId);
    const v = await adapter.getEditResult(edit.jobId);
    expect(st().addVersion(v!).ok).toBe(true);
    const [orig, rev] = versionsOf(st().versions, concept.id);
    expect(rev).toMatchObject({ number: 2, parentId: orig.id, brandProfileVersion: BRAND_PROFILE.version });
    expect(rev.snapshot.silhouette).toBe("fitted");
    expect(rev.snapshot.fabrics).toEqual(["washed linen"]);

    // 8. Compare original vs revised: original untouched, annotation still on v1.
    expect(orig).toEqual(v1);
    expect(st().annotations.find((a) => a.conceptId === concept.id)!.versionId).toBe(v1.id);

    // 9. Brand alignment recalculated for the revision.
    const before = evaluateConcept({ ...concept, ...orig.snapshot }, BRAND_PROFILE.content);
    const after = evaluateConcept({ ...concept, ...rev.snapshot }, BRAND_PROFILE.content);
    expect(after.checks.find((c) => c.ruleId === "r_shoulder")!.result).toBe("fail"); // fitted isn't structured/tailored
    expect(before.score).not.toBe(after.score);

    // 10–13. Save to collection, reorder, note.
    expect(st().saveToCollection(concept.id, "col_aw26")).toEqual({ ok: true });
    const ids = () => st().collections.find((c) => c.id === "col_aw26")!.conceptIds;
    st().moveLook("col_aw26", concept.id, -1);
    expect(ids().at(-2)).toBe(concept.id);
    st().updateCollection("col_aw26", { creativeDirection: "Linen tailoring, narrow shoulders" });

    // 14. Approve the concept (simulated review).
    st().review(concept.id, "submit");
    expect(st().review(concept.id, "approve").ok).toBe(true);

    // 15–16. Presentation covers intro + every look + close.
    const last = presentationStep(0, "End", ids().length);
    expect(last).toBe(ids().length + 1);
    const presented = st().concepts.find((c) => c.id === concept.id)!;
    expect(presented).toMatchObject({ status: "approved", silhouette: "fitted", capability: "simulated" });

    // Nothing historical was rewritten, and it all survives a reload.
    const persisted = JSON.parse(localStorage.getItem("raco-studio")!).state;
    expect(persisted.versions.filter((x: { conceptId: string }) => x.conceptId === concept.id)).toHaveLength(2);
    expect(JSON.stringify(persisted)).not.toMatch(/blob:|data:image/);
  });
});
