import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { capabilityRegistry } from "@/lib/config/capabilities";
import { DEMO_CONCEPT_ID } from "@/lib/fixtures/demo";
import { getAIProvider } from "@/lib/services";
import { useBrandStore } from "@/lib/store/brand-store";
import { useDemoStore } from "@/lib/store/demo-store";
import { useHandoffStore } from "@/lib/store/handoff-store";
import { useStudioStore } from "@/lib/store/studio-store";
import { resetDemo, userWorkSummary } from "./reset";
import { demoScenes } from "./scenes";

const routeExists = (href: string) => {
  const p = href.split(/[?#]/)[0];
  const base = path.resolve(__dirname, "../../app");
  const candidates = [path.join(base, "(studio)", p, "page.tsx"), path.join(base, p, "page.tsx"), path.join(base, "(studio)", "page.tsx")];
  if (p.startsWith("/present/")) return fs.existsSync(path.join(base, "present", "[id]", "page.tsx"));
  if (p.startsWith("/collections/")) return fs.existsSync(path.join(base, "(studio)", "collections", "[id]", "page.tsx"));
  return candidates.slice(0, p === "/" ? 3 : 2).some((c) => fs.existsSync(c));
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetDemo();
  useDemoStore.setState({ active: false, index: 0 });
});

describe("guided demo scenes", () => {
  it("has five scenes, ending in the pilot screen, with every link pointing at a real route", () => {
    const scenes = demoScenes();
    expect(scenes.map((s) => s.id)).toEqual(["brand", "generate", "refine", "collection", "handoff"]);
    expect(scenes.at(-1)!.steps.at(-1)!.href).toBe("/pilot");
    for (const s of scenes) for (const step of s.steps) expect(routeExists(step.href), step.href).toBe(true);
    expect(scenes[2].steps[0].href).toContain(DEMO_CONCEPT_ID);
  });
  it("navigates with clamped previous/next and exit", () => {
    const d = useDemoStore.getState();
    d.start();
    d.go(3, 5);
    expect(useDemoStore.getState()).toMatchObject({ active: true, index: 3 });
    useDemoStore.getState().go(9, 5);
    expect(useDemoStore.getState().index).toBe(4);
    useDemoStore.getState().go(-2, 5);
    expect(useDemoStore.getState().index).toBe(0);
    useDemoStore.getState().exit();
    expect(useDemoStore.getState().active).toBe(false);
  });
});

describe("feature flags", () => {
  it("drop disabled modules from the demo and the capability list", () => {
    const noTryOn = demoScenes({ virtualTryOn: false, technicalDevelopment: true });
    expect(JSON.stringify(noTryOn)).not.toContain("/try-on");
    expect(noTryOn.at(-1)!.steps.map((s) => s.href)).toEqual(["/technical?brief=brief_demo_1", "/pilot"]);
    const neither = demoScenes({ virtualTryOn: false, technicalDevelopment: false });
    expect(neither.at(-1)!.steps.map((s) => s.href)).toEqual(["/pilot"]);
  });
});

describe("capability registry accuracy", () => {
  it("marks AI features simulated while the demo adapter is in use", () => {
    const caps = capabilityRegistry(getAIProvider());
    expect(getAIProvider().info.capability).toBe("simulated");
    for (const id of ["generation", "brand-synthesis", "refinement", "try-on"]) expect(caps.find((c) => c.id === id)!.status).toBe("simulated");
    expect(caps.filter((c) => c.status === "functional").map((c) => c.id)).not.toEqual(expect.arrayContaining(["generation", "try-on"]));
  });
  it("would mark them functional only with a live provider", () => {
    const caps = capabilityRegistry({ info: { id: "x", label: "x", capability: "live" } });
    expect(caps.find((c) => c.id === "generation")!.status).toBe("functional");
  });
  it("gives every functional or simulated feature a real route, and none to production-only items", () => {
    for (const c of capabilityRegistry(getAIProvider())) {
      if (c.status === "production_required") expect(c.route).toBeUndefined();
      else expect(routeExists(c.route!), c.id).toBe(true);
    }
  });
});

describe("reset demo", () => {
  it("reports custom work and restores the curated dataset", () => {
    expect(userWorkSummary()).toEqual({});
    useStudioStore.getState().saveRevision("cpt_03", { ...useStudioStore.getState().versions.find((v) => v.id === "cpt_03_v1")!.snapshot, silhouette: "fitted" });
    useBrandStore.getState().edit("x", (c) => ({ ...c, name: "Changed" }));
    useHandoffStore.getState().createBrief("cpt_03", "cpt_03_v1", "org_serein");
    expect(userWorkSummary()).toMatchObject({ "design versions": 1, "Brand DNA versions": 1, "technical briefs": 1 });
    resetDemo();
    expect(userWorkSummary()).toEqual({});
    expect(useStudioStore.getState().concepts.find((c) => c.id === DEMO_CONCEPT_ID)!.currentVersionId).toBe("cpt_01_v2");
    expect(useHandoffStore.getState().briefs.map((b) => b.id)).toEqual(["brief_demo_1"]);
  });
  it("ships a consistent curated dataset (stable ids, valid relationships)", () => {
    const s = useStudioStore.getState();
    const ids = new Set(s.versions.map((v) => v.id));
    expect(s.annotations.every((a) => ids.has(a.versionId))).toBe(true);
    expect(s.reviews.every((r) => ids.has(r.versionId))).toBe(true);
    const h = useHandoffStore.getState();
    expect(h.briefs.every((b) => ids.has(b.versionId))).toBe(true);
    expect(h.previews.every((p) => ids.has(p.versionId))).toBe(true);
    expect(h.previews.length).toBeGreaterThanOrEqual(3);
  });
});
