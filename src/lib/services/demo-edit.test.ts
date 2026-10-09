import { describe, expect, it } from "vitest";
import { CONCEPTS } from "@/lib/fixtures";
import { snapshotOf } from "@/lib/editor/versions";
import { applyEdit, parseInstruction, targetsAccent } from "./demo-edit";

const base = { ...snapshotOf(CONCEPTS[0]), silhouette: "oversized" as const, fabrics: ["lightweight wool"], details: ["single covered button", "bound seams"] };
const attrs = (s: string) => parseInstruction(s, base).changes.map((c) => `${c.attribute}:${c.to}`);

describe("refinement interpreter (supported commands)", () => {
  it.each([
    ["Make the shoulders more structured", ["silhouette:structured"]],
    ["Use linen instead of wool", ["material:washed linen"]],
    ["Create a more relaxed version", ["silhouette:relaxed"]],
    ["Change the primary colour to oxblood", ["colour:Oxblood"]],
    ["Simplify the fastening details", ["detail:clean facings, no visible hardware"]],
    ["Make it fitted and use linen instead of wool", ["silhouette:fitted", "material:washed linen"]],
    ["Switch from navy to camel", ["colour:Camel"]],
  ])("%s", (instruction, expected) => {
    expect(attrs(instruction)).toEqual(expected);
  });

  it("applies changes to a copy and leaves the base untouched", () => {
    const before = structuredClone(base);
    const { changes } = parseInstruction("Use linen instead of wool", base);
    const next = applyEdit(base, changes, "Use linen instead of wool");
    expect(next.fabrics).toEqual(["washed linen"]);
    expect(base).toEqual(before);
  });

  it("keeps the description consistent with changed attributes", () => {
    const b = { ...base, description: "Blazer in lightweight wool with generous oversized proportions. Clean facings, bound seams. Palette: stone and espresso." };
    const { changes } = parseInstruction("Make it fitted in linen and change the colour to oxblood", b);
    const next = applyEdit(b, changes, "x");
    expect(next.description).toContain("washed linen");
    expect(next.description).toContain("a close, fitted line");
    expect(next.description).toMatch(/Palette: oxblood and /);
    expect(next.description).not.toContain("stone and espresso.");
  });

  it("routes colour to the accent band for lower regions", () => {
    expect(targetsAccent({ x: 0.2, y: 0.8, w: 0.3, h: 0.1 })).toBe(true);
    expect(parseInstruction("Make it oxblood", base, { x: 0.2, y: 0.8, w: 0.3, h: 0.1 }).changes[0].attribute).toBe("accent");
  });
});

describe("refinement interpreter (unsupported commands)", () => {
  it("reports unsupported requests and changes nothing", () => {
    const r = parseInstruction("Adjust sleeve proportions", base);
    expect(r.changes).toEqual([]);
    expect(r.unsupported).toContain("sleeve");
  });
  it("ignores no-op requests for the current value", () => {
    expect(parseInstruction("Keep it oversized", base).changes).toEqual([]);
  });
});
