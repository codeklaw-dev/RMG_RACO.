import { beforeEach, describe, expect, it } from "vitest";
import { approvedVersion, workingVersion } from "@/lib/brand/versioning";
import { useBrandStore } from "./brand-store";

beforeEach(() => {
  localStorage.clear();
  useBrandStore.getState().reset();
});

describe("brand store", () => {
  it("logs changes and persists versions without image data", () => {
    const s = useBrandStore.getState();
    expect(s.edit("Palette", (c) => ({ ...c, name: "Serein" })).ok).toBe(true);
    expect(useBrandStore.getState().changes.map((c) => c.action)).toEqual(expect.arrayContaining(["edited", "created_draft"]));
    const saved = localStorage.getItem("raco-brand") ?? "";
    expect(JSON.parse(saved).state.versions).toHaveLength(4);
    expect(saved).not.toMatch(/blob:|data:image/);
  });

  it("returns errors instead of throwing for invalid workflow steps", () => {
    const res = useBrandStore.getState().approve();
    expect(res).toEqual({ ok: false, error: expect.stringMatching(/in review/) });
  });

  it("approves through the workflow", () => {
    const s = useBrandStore.getState();
    s.edit("x", (c) => c);
    s.submit();
    s.approve();
    const vs = useBrandStore.getState().versions;
    expect(approvedVersion(vs)?.version).toBe(4);
    expect(workingVersion(vs)).toBeNull();
  });

  it("falls back to fixtures when persisted data is corrupt", async () => {
    localStorage.setItem("raco-brand", JSON.stringify({ state: { versions: [{ nope: 1 }] }, version: 1 }));
    await useBrandStore.persist.rehydrate();
    expect(approvedVersion(useBrandStore.getState().versions)?.version).toBe(3);
  });
});
