import { describe, expect, it } from "vitest";
import { COLLECTIONS, CONCEPTS } from "@/lib/fixtures";
import { nudge, toNormalized, toPixels } from "./annotations";
import { collectionPalette, groupLooks, nextCollectionStatus, presentationStep } from "./collections";
import { availableActions, reviewTransition } from "./review";

describe("annotation coordinates", () => {
  it("normalise the same garment point identically at any rendered size", () => {
    const small = toNormalized({ x: 10 + 120 * 0.3, y: 20 + 160 * 0.2 }, { left: 10, top: 20, width: 120, height: 160 });
    const large = toNormalized({ x: 400 + 480 * 0.3, y: 50 + 640 * 0.2 }, { left: 400, top: 50, width: 480, height: 640 });
    expect(small.x).toBeCloseTo(0.3);
    expect(small.y).toBeCloseTo(0.2);
    expect(large).toEqual(small);
  });
  it("map back to pixels proportionally after a resize", () => {
    expect(toPixels({ x: 0.3, y: 0.2 }, { width: 300, height: 400 })).toEqual({ left: 90, top: 80 });
    expect(toPixels({ x: 0.3, y: 0.2 }, { width: 600, height: 800 })).toEqual({ left: 180, top: 160 });
  });
  it("clamp to the artboard and nudge by keyboard", () => {
    expect(toNormalized({ x: -50, y: 9999 }, { left: 0, top: 0, width: 100, height: 100 })).toEqual({ x: 0, y: 1 });
    expect(nudge({ x: 0.5, y: 0.5 }, "ArrowRight")).toEqual({ x: 0.52, y: 0.5 });
    expect(nudge({ x: 0.5, y: 0.5 }, "ArrowUp", true).y).toBeCloseTo(0.4);
    expect(nudge({ x: 0.99, y: 0.5 }, "ArrowRight", true).x).toBe(1);
  });
});

describe("concept review transitions", () => {
  it("allows the documented path and rejects invalid steps", () => {
    expect(reviewTransition("draft", "submit")).toBe("in_review");
    expect(reviewTransition("in_review", "approve")).toBe("approved");
    expect(reviewTransition("in_review", "reject")).toBe("rejected");
    expect(reviewTransition("rejected", "reopen")).toBe("draft");
    expect(() => reviewTransition("draft", "approve")).toThrow(/Cannot approve/);
    expect(() => reviewTransition("approved", "submit")).toThrow();
    expect(availableActions("approved")).toEqual(["archive"]);
  });
});

describe("collections helpers", () => {
  const looks = CONCEPTS.filter((c) => c.collectionId === "col_aw26");
  it("summarises palette usage by frequency", () => {
    const p = collectionPalette(looks);
    expect(p[0].count).toBeGreaterThanOrEqual(p[p.length - 1].count);
    expect(p.reduce((n, x) => n + x.count, 0)).toBe(looks.reduce((n, c) => n + c.palette.length, 0));
  });
  it("groups looks by design direction", () => {
    const sections = groupLooks(looks, COLLECTIONS[0]);
    expect(sections.map((s) => s.name)).toEqual(["Outerwear & tailoring", "Soft columns"]);
    expect(sections.flatMap((s) => s.looks)).toHaveLength(looks.length);
  });
  it("keeps collection approval as its own step sequence", () => {
    expect(nextCollectionStatus("concept")?.to).toBe("in_review");
    expect(nextCollectionStatus("in_review")?.to).toBe("approved");
    expect(nextCollectionStatus("approved")).toBeNull();
  });
  it("navigates presentation slides with the keyboard", () => {
    expect(presentationStep(0, "ArrowRight", 3)).toBe(1);
    expect(presentationStep(0, "ArrowLeft", 3)).toBe(0);
    expect(presentationStep(1, "End", 3)).toBe(4);
    expect(presentationStep(4, "ArrowRight", 3)).toBe(4);
    expect(presentationStep(3, "Home", 3)).toBe(0);
    expect(presentationStep(2, "x", 3)).toBe(2);
  });
});
