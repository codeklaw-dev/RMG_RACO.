import { beforeEach, describe, expect, it } from "vitest";
import { BRAND_PROFILE, CONCEPTS, ORG } from "@/lib/fixtures";
import { useStudioSession } from "@/lib/store/studio-session";
import { DEFAULT_BRIEF, buildGenerateRequest, briefFromConcept } from "./brief";

const build = (mode: "explore" | "brand" | "hybrid") =>
  buildGenerateRequest({ ...DEFAULT_BRIEF, prompt: "test brief", mode }, { orgId: ORG.id, brand: BRAND_PROFILE, idempotencyKey: "k_12345678" });

describe("request assembly per mode", () => {
  it("Explore sends no brand context", () => {
    expect(build("explore")).toMatchObject({ mode: "explore", brandContext: null, brandProfileVersion: null });
  });

  it("Brand and Hybrid attach the profile with different exploration weights", () => {
    const brand = build("brand");
    const hybrid = build("hybrid");
    expect(brand.brandContext).toMatchObject({ profileId: BRAND_PROFILE.id, version: BRAND_PROFILE.version, explorationWeight: 0.2 });
    expect(brand.brandContext?.styleRuleIds).toHaveLength(BRAND_PROFILE.styleRules.length);
    expect(hybrid.brandContext?.explorationWeight).toBe(0.5);
    expect(brand.brandProfileVersion).toBe(BRAND_PROFILE.version);
  });
});

describe("studio session mode switching", () => {
  beforeEach(() => useStudioSession.setState({ brief: DEFAULT_BRIEF }));

  it("updates mode, default creativity, and drops non-brand colours in Brand mode", () => {
    const { setBrief, setMode } = useStudioSession.getState();
    setBrief({ palette: [BRAND_PROFILE.palette[0].hex, "#5F6B4E"] });
    setMode("brand");
    const { brief } = useStudioSession.getState();
    expect(brief.mode).toBe("brand");
    expect(brief.creativity).toBe(0.25);
    expect(brief.palette).toEqual([BRAND_PROFILE.palette[0].hex]);
  });

  it("loads a variation brief without touching the source concept", () => {
    const source = CONCEPTS[0];
    const snapshot = structuredClone(source);
    const brief = briefFromConcept(source, DEFAULT_BRIEF);
    expect(brief).toMatchObject({ variationOf: source.id, category: source.category, prompt: source.prompt, count: 2 });
    expect(source).toEqual(snapshot);
  });
});
