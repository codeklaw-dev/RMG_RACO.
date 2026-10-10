import { beforeEach, describe, expect, it } from "vitest";
import { CONCEPTS } from "@/lib/fixtures";
import { DEMO_VERSIONS } from "@/lib/fixtures/demo";
import { FIT_MODELS } from "@/lib/fixtures/fit-models";
import { tryOnRequestSchema } from "@/lib/services/ai-provider";
import { DURATION_MS, DemoAIAdapter, QUEUE_MS } from "@/lib/services/demo-adapter";
import { useHandoffStore } from "@/lib/store/handoff-store";
import { useStudioStore } from "@/lib/store/studio-store";
import { TRY_ON_LABEL } from "@/lib/types/handoff";

const v2 = DEMO_VERSIONS[0];
const req = (patch = {}) => ({
  orgId: "org_serein", conceptId: "cpt_01", versionId: v2.id, modelId: "fm_a", pose: "standing" as const, background: "paper" as const, colour: null,
  garment: { title: v2.snapshot.title, silhouette: v2.snapshot.silhouette, palette: v2.snapshot.palette, seed: v2.snapshot.seed },
  consentConfirmed: true as const, idempotencyKey: `key_${Math.random().toString(36).slice(2, 10)}`, ...patch,
});

let clock = 5_000_000;
beforeEach(() => {
  localStorage.clear();
  useStudioStore.getState().reset();
  useHandoffStore.getState().reset();
});

describe("try-on request validation", () => {
  it("accepts a valid request and rejects bad input", () => {
    expect(tryOnRequestSchema.safeParse(req()).success).toBe(true);
    expect(tryOnRequestSchema.safeParse(req({ consentConfirmed: false })).success).toBe(false);
    expect(tryOnRequestSchema.safeParse(req({ pose: "sitting" })).success).toBe(false);
    expect(tryOnRequestSchema.safeParse(req({ colour: "red" })).success).toBe(false);
    expect(tryOnRequestSchema.safeParse(req({ garment: { ...req().garment, palette: [] } })).success).toBe(false);
  });
  it("rejects unknown models and poses a model doesn't have (model selection)", async () => {
    const a = new DemoAIAdapter(() => clock);
    await expect(a.virtualTryOn(req({ modelId: "fm_x" }))).rejects.toMatchObject({ code: "validation" });
    expect(FIT_MODELS.find((m) => m.id === "fm_c")!.poses).not.toContain("walking");
    await expect(a.virtualTryOn(req({ modelId: "fm_c", pose: "walking" }))).rejects.toThrow(/no walking pose/);
  });
});

describe("preview job lifecycle", () => {
  it("queued → running → succeeded with a labelled, provenance-bearing preview", async () => {
    const a = new DemoAIAdapter(() => clock);
    const { jobId } = await a.virtualTryOn(req({ modelId: "fm_b", pose: "walking", colour: "#1C1C1E" }));
    expect((await a.getJob(jobId)).status).toBe("queued");
    clock += QUEUE_MS + 100;
    expect((await a.getJob(jobId)).status).toBe("running");
    expect(await a.getTryOnResult(jobId)).toBeNull();
    clock += DURATION_MS.try_on;
    const p = (await a.getTryOnResult(jobId))!;
    expect(p).toMatchObject({ conceptId: "cpt_01", versionId: v2.id, modelId: "fm_b", pose: "walking", colour: "#1C1C1E", label: TRY_ON_LABEL });
    expect(p.provenance).toMatch(/no try-on model/);
  });
  it("can be cancelled", async () => {
    const a = new DemoAIAdapter(() => clock);
    const { jobId } = await a.virtualTryOn(req());
    clock += QUEUE_MS + 200;
    await a.cancelJob(jobId);
    clock += DURATION_MS.try_on;
    expect((await a.getJob(jobId)).status).toBe("canceled");
    expect(await a.getTryOnResult(jobId)).toBeNull();
  });
});

describe("preview persistence and comparison data", () => {
  it("stores previews with the version number, saves them and persists metadata only", async () => {
    const a = new DemoAIAdapter(() => clock);
    const { jobId } = await a.virtualTryOn(req());
    clock += QUEUE_MS + DURATION_MS.try_on;
    const p = (await a.getTryOnResult(jobId))!;
    const h = useHandoffStore.getState();
    expect(h.addPreview(p).ok).toBe(true);
    expect(useHandoffStore.getState().addPreview(p).ok).toBe(false);
    useHandoffStore.getState().setPreviewSaved(p.id, true);
    const stored = useHandoffStore.getState().previews.find((x) => x.id === p.id)!;
    expect(stored).toMatchObject({ versionNumber: 2, saved: true });
    const raw = localStorage.getItem("raco-handoff")!;
    expect(raw).toContain(p.id);
    expect(raw).not.toMatch(/blob:|data:image/);
    const saved = useHandoffStore.getState().previews.filter((x) => x.saved);
    expect(saved.length).toBeGreaterThanOrEqual(2); // curated + new: enough to compare
  });
});

describe("organisation isolation", () => {
  it("refuses previews and briefs for another organisation's garment", () => {
    useStudioStore.getState().addConcepts([{ ...CONCEPTS[1], id: "foreign", orgId: "org_other", currentVersionId: "foreign_v1" }]);
    const h = useHandoffStore.getState();
    const preview = { ...useHandoffStore.getState().previews[0], id: "p_x", conceptId: "foreign", versionId: "foreign_v1", orgId: "org_serein" };
    expect(h.addPreview(preview)).toEqual({ ok: false, error: "Garment belongs to another organisation" });
    expect(h.createBrief("foreign", "foreign_v1", "org_serein")).toEqual({ ok: false, error: "Concept belongs to another organisation" });
  });
});
