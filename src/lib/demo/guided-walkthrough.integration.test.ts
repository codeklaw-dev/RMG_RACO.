// Final acceptance scenario, end to end through real adapters and stores.
import { beforeEach, describe, expect, it } from "vitest";
import { capabilityRegistry } from "@/lib/config/capabilities";
import { evaluateConcept } from "@/lib/brand/intelligence";
import { approvedVersion } from "@/lib/brand/versioning";
import { presentationStep } from "@/lib/editor/collections";
import { versionsOf } from "@/lib/editor/versions";
import { buildBriefDocument, missingInfo } from "@/lib/handoff/technical";
import { renderBriefPdf } from "@/lib/handoff/pdf";
import { ORG } from "@/lib/fixtures";
import { DURATION_MS, DemoAIAdapter, QUEUE_MS } from "@/lib/services/demo-adapter";
import { DEFAULT_BRIEF, buildGenerateRequest, strictnessFor } from "@/lib/studio/brief";
import { useBrandStore } from "@/lib/store/brand-store";
import { useDemoStore } from "@/lib/store/demo-store";
import { useHandoffStore } from "@/lib/store/handoff-store";
import { useStudioStore } from "@/lib/store/studio-store";
import { TRY_ON_LABEL } from "@/lib/types/handoff";
import { resetDemo } from "./reset";
import { demoScenes } from "./scenes";

let clock = 9_000_000;
const tick = (ms: number) => (clock += ms);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetDemo();
});

describe("complete client demonstration (clean session)", () => {
  it("runs brand → generate → refine → collection → try-on → handoff → pilot", async () => {
    const adapter = new DemoAIAdapter(() => clock);
    // 1–2. Start the guided demo.
    useDemoStore.getState().start();
    const scenes = demoScenes();
    // 3. Approved Brand DNA.
    const brand = approvedVersion(useBrandStore.getState().versions)!;
    expect(brand.version).toBe(3);
    // 4. Generate brand-consistent concepts.
    useDemoStore.getState().go(1, scenes.length);
    const brief = { ...DEFAULT_BRIEF, prompt: "Structured wool overcoat for AW26", category: "outerwear" as const, silhouette: "structured" as const, mode: "brand" as const, brandStrictness: strictnessFor("brand"), count: 4 };
    const gen = await adapter.generateConcepts(buildGenerateRequest(brief, { orgId: ORG.id, brand, idempotencyKey: "key_final_1" }));
    tick(QUEUE_MS + DURATION_MS.generate);
    await adapter.getJob(gen.jobId);
    const results = await adapter.getResults(gen.jobId);
    useStudioStore.getState().addConcepts(results);
    expect(results.every((c) => c.brandProfileVersion === 3 && c.capability === "simulated")).toBe(true);
    // 5–7. Select one, open in the Editor, create a revision.
    const concept = results[0];
    const v1 = versionsOf(useStudioStore.getState().versions, concept.id)[0];
    const edit = await adapter.editConcept({ orgId: ORG.id, conceptId: concept.id, parentVersionId: v1.id, instruction: "Use linen instead of wool", base: v1.snapshot, idempotencyKey: "key_final_2" });
    tick(QUEUE_MS + DURATION_MS.edit);
    await adapter.getJob(edit.jobId);
    expect(useStudioStore.getState().addVersion((await adapter.getEditResult(edit.jobId))!).ok).toBe(true);
    // 8. Compare versions.
    const [orig, rev] = versionsOf(useStudioStore.getState().versions, concept.id);
    expect(orig).toEqual(v1);
    expect(rev.snapshot.fabrics).toEqual(["washed linen"]);
    expect(evaluateConcept({ ...concept, ...rev.snapshot }, brand.content).score).not.toBeNull();
    // 9–10. Save into a collection and present it.
    expect(useStudioStore.getState().saveToCollection(concept.id, "col_aw26")).toEqual({ ok: true });
    const looks = useStudioStore.getState().collections.find((c) => c.id === "col_aw26")!.conceptIds;
    expect(presentationStep(0, "End", looks.length)).toBe(looks.length + 1);
    // 11–12. Conceptual try-on of the revised version.
    const head = useStudioStore.getState().concepts.find((c) => c.id === concept.id)!;
    const t = await adapter.virtualTryOn({
      orgId: ORG.id, conceptId: concept.id, versionId: head.currentVersionId, modelId: "fm_a", pose: "standing", background: "paper", colour: null,
      garment: { title: rev.snapshot.title, silhouette: rev.snapshot.silhouette, palette: rev.snapshot.palette, seed: rev.snapshot.seed }, consentConfirmed: true, idempotencyKey: "key_final_3",
    });
    tick(QUEUE_MS + DURATION_MS.try_on);
    await adapter.getJob(t.jobId);
    const preview = (await adapter.getTryOnResult(t.jobId))!;
    expect(useHandoffStore.getState().addPreview(preview).ok).toBe(true);
    expect(useHandoffStore.getState().previews[0]).toMatchObject({ label: TRY_ON_LABEL, versionNumber: 2 });
    // 13–15. Technical handoff: create and edit a brief.
    const created = useHandoffStore.getState().createBrief(concept.id, head.currentVersionId, ORG.id);
    expect(created.ok).toBe(true);
    const id = created.ok ? created.value : "";
    const before = missingInfo(useHandoffStore.getState().briefs.find((b) => b.id === id)!).length;
    useHandoffStore.getState().updateBrief(id, (b) => ({ ...b, construction: { ...b.construction, sleeves: "Two-piece set-in sleeve" }, measurements: b.measurements.map((m) => (m.name === "Chest width" ? { ...m, valueCm: 56, toleranceCm: 1 } : m)) }));
    const techBrief = useHandoffStore.getState().briefs.find((b) => b.id === id)!;
    expect(missingInfo(techBrief).length).toBe(before - 2);
    // 16. Export.
    const doc = buildBriefDocument(techBrief, { concept: head, version: rev, collectionNames: ["Quiet Architecture"], brandVersion: 3, conceptReview: "Draft", generatedAt: "now" });
    const pdf = (await renderBriefPdf(doc, [], { compress: false })).output();
    expect(pdf).toContain("Preliminary Garment Development Brief");
    expect(pdf).toContain("Two-piece set-in sleeve");
    // 17. Pilot architecture and limitations.
    useDemoStore.getState().go(4, scenes.length);
    expect(scenes[4].steps.at(-1)!.href).toBe("/pilot");
    const caps = capabilityRegistry(adapter);
    expect(caps.filter((c) => c.status === "simulated").map((c) => c.id)).toEqual(["generation", "brand-synthesis", "refinement", "try-on"]);
  });
});
