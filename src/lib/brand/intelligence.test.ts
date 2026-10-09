import { describe, expect, it } from "vitest";
import { BRAND_PROFILE, BRAND_REFERENCES, CONCEPTS } from "@/lib/fixtures";
import { generateRequestSchema } from "@/lib/services/ai-provider";
import { synthesizeConcepts } from "@/lib/services/demo-engine";
import { approve, approvedVersion, editDraft, submitForReview } from "./versioning";
import { buildBrandContext, completeness, detectConflicts, diffContent, evaluateConcept } from "./intelligence";
import { DEFAULT_BRIEF, buildGenerateRequest, strictnessFor } from "@/lib/studio/brief";
import { BRAND_VERSIONS } from "@/lib/fixtures";

const content = BRAND_PROFILE.content;

describe("completeness", () => {
  it("is computed from profile data", () => {
    const full = completeness(content, BRAND_REFERENCES).score;
    const emptied = completeness({ ...content, palette: [], identity: { ...content.identity, keywords: [] } }, BRAND_REFERENCES).score;
    expect(full).toBeGreaterThan(emptied);
    expect(completeness(content, []).checks.find((c) => c.label.includes("references"))?.done).toBe(false);
  });
});

describe("conflict detection", () => {
  it("flags a silhouette both preferred and avoided", () => {
    const rules = content.rules.map((r) => (r.id === "n_oversized" ? { ...r, enabled: true, effect: { type: "avoid_silhouette" as const, values: ["structured" as const] } } : r));
    const conflicts = detectConflicts({ ...content, rules });
    expect(conflicts.some((c) => c.ids.includes("r_shoulder") && c.ids.includes("n_oversized"))).toBe(true);
  });
  it("reports no conflicts for the approved fixture", () => {
    expect(detectConflicts(content)).toEqual([]);
  });
});

describe("brand context", () => {
  it("is null for Explore and for unapproved versions", () => {
    expect(buildBrandContext("explore", BRAND_PROFILE)).toBeNull();
    expect(buildBrandContext("brand", { ...BRAND_PROFILE, status: "draft" })).toBeNull();
    expect(buildBrandContext("brand", null)).toBeNull();
  });
  it("ignores disabled rules and maps effects", () => {
    const bc = buildBrandContext("brand", BRAND_PROFILE)!;
    expect(bc.avoidSilhouettes).toEqual([]); // n_oversized is disabled in v3
    expect(bc.preferredSilhouettes).toEqual(["structured", "tailored"]);
    expect(bc.avoidMaterials).toEqual(expect.arrayContaining(["technical", "denim"]));
    expect(bc.paletteOnly).toBe(true);
    expect(bc.guidance).toContain("No visible branding");
  });
});

describe("evaluation", () => {
  it("passes and fails structured checks and skips guidance", () => {
    const concept = { ...CONCEPTS[0], silhouette: "oversized" as const, fabrics: ["bonded technical shell"], details: ["exposed metal hardware", "bound seams"] };
    const { checks, score } = evaluateConcept(concept, content);
    const by = (id: string) => checks.find((c) => c.ruleId === id)!.result;
    expect(by("r_shoulder")).toBe("fail");
    expect(by("n_synthetic")).toBe("fail");
    expect(by("n_hardware")).toBe("fail");
    expect(by("n_logos")).toBe("not_evaluated");
    expect(score).toBeLessThan(50);
  });
});

describe("diff", () => {
  it("lists changed rules between versions", () => {
    const changes = diffContent(BRAND_VERSIONS[1].content, BRAND_VERSIONS[2].content);
    expect(changes.some((c) => c.section === "Rules" && c.label.startsWith("Added"))).toBe(true);
    expect(diffContent(content, content)).toEqual([]);
  });
});

describe("key demonstration: changing an approved rule changes later requests and outcomes", () => {
  const brief = { ...DEFAULT_BRIEF, prompt: "Oversized charcoal wool blazer", mode: "brand" as const, silhouette: "oversized" as const, brandStrictness: strictnessFor("brand"), count: 4 };
  const generate = (approvedVersionObj: typeof BRAND_PROFILE) => {
    const req = generateRequestSchema.parse(buildGenerateRequest(brief, { orgId: "org_serein", brand: approvedVersionObj, idempotencyKey: "key_demo_123" }));
    return { req, concepts: synthesizeConcepts(req, { jobId: "job_demo", now: "2026-10-09T00:00:00Z" }) };
  };

  it("draft edits do nothing until approved; approval changes metadata and results", () => {
    const before = generate(BRAND_PROFILE);
    expect(before.req.brandContext?.avoidSilhouettes).toEqual([]);

    const drafted = editDraft(BRAND_VERSIONS, (c) => ({ ...c, rules: c.rules.map((r) => (r.id === "n_oversized" ? { ...r, enabled: true } : r)) })).versions;
    // Still v3 conditions generation while v4 is a draft.
    expect(generate(approvedVersion(drafted)!).req.brandContext?.version).toBe(3);

    const v4 = approvedVersion(approve(submitForReview(drafted), "tester"))!;
    const after = generate(v4);
    expect(after.req.brandContext).toMatchObject({ version: 4, avoidSilhouettes: ["oversized"] });
    expect(after.concepts.every((c) => c.silhouette !== "oversized")).toBe(true);
    expect(after.concepts.every((c) => c.brandProfileVersion === 4)).toBe(true);
    // Only the governed attribute moves: fabrics and palettes are unchanged.
    expect(after.concepts.map((c) => c.fabrics)).toEqual(before.concepts.map((c) => c.fabrics));
    expect(after.concepts.map((c) => c.palette)).toEqual(before.concepts.map((c) => c.palette));
    expect(after.concepts.map((c) => evaluateConcept(c, v4.content).checks.find((x) => x.ruleId === "n_oversized")?.result)).not.toContain("fail");
  });
});
