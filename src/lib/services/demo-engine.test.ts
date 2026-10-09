import { describe, expect, it } from "vitest";
import { BRAND_PROFILE } from "@/lib/fixtures";
import { makeRequest } from "@/test/factories";
import { generateRequestSchema } from "./ai-provider";
import { choosePalette, synthesizeConcepts } from "./demo-engine";

const run = (patch = {}, jobId = "job_x") =>
  synthesizeConcepts(generateRequestSchema.parse(makeRequest(patch)), { jobId, now: "2026-10-09T00:00:00Z" });
const content = (cs: ReturnType<typeof run>) => cs.map(({ id, currentVersionId, jobId, ...rest }) => (void id, void currentVersionId, void jobId, rest));

describe("demo engine", () => {
  it("is deterministic for the same request and seed", () => {
    expect(content(run({}, "a"))).toEqual(content(run({}, "b")));
  });

  it("changes output when seed or attributes change", () => {
    expect(content(run({ seed: 1 }))).not.toEqual(content(run({ seed: 2 })));
    const dresses = run({ category: "dress" });
    expect(dresses.every((c) => c.category === "dress")).toBe(true);
  });

  it("returns the requested count with honest labels", () => {
    const cs = run({ count: 3 });
    expect(cs).toHaveLength(3);
    expect(cs.every((c) => c.capability === "simulated" && /no model inference/.test(c.provenance))).toBe(true);
  });

  it("keeps Brand mode within the brand palette and silhouette", () => {
    const brandHexes = BRAND_PROFILE.palette.map((p) => p.hex);
    const cs = run({ mode: "brand", silhouette: "structured" });
    expect(cs.every((c) => c.palette.every((p) => brandHexes.includes(p.hex)))).toBe(true);
    expect(cs.every((c) => c.silhouette === "structured")).toBe(true);
    expect(cs.every((c) => c.brandProfileVersion === BRAND_PROFILE.version)).toBe(true);
  });

  it("links variations to their source concept", () => {
    expect(run({ variationOf: "cpt_01" }).every((c) => c.parentConceptId === "cpt_01")).toBe(true);
  });
});

describe("palette fallback", () => {
  const req = (patch: object, brandPalette: string[] | null) => {
    const base = generateRequestSchema.parse(makeRequest(patch));
    return { ...base, brandContext: base.brandContext && brandPalette ? { ...base.brandContext, palette: brandPalette } : base.brandContext };
  };
  const rng = () => 0.5;

  it("never returns empty or undefined colours when the brand palette is empty", () => {
    for (const mode of ["brand", "hybrid"] as const) {
      const p = choosePalette(req({ mode }, []), rng);
      expect(p.length).toBeGreaterThan(0);
      expect(p.every((c) => c && /^#/.test(c.hex))).toBe(true);
    }
  });

  it("does not duplicate a colour in Hybrid when brand and chosen palettes overlap", () => {
    const hex = BRAND_PROFILE.palette[0].hex;
    const p = choosePalette(req({ mode: "hybrid", palette: [hex] }, [hex]), rng);
    expect(new Set(p.map((c) => c.hex)).size).toBe(p.length);
  });

  it("Brand mode ignores chosen colours outside the brand palette", () => {
    const p = choosePalette(req({ mode: "brand", palette: ["#5F6B4E"] }, null), rng);
    const brandHexes = BRAND_PROFILE.palette.map((c) => c.hex);
    expect(p.every((c) => brandHexes.includes(c.hex))).toBe(true);
  });
});
