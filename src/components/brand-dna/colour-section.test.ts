import { describe, expect, it } from "vitest";
import { validatePalette } from "./colour-section";

const c = (id: string, name: string, hex: string) => ({ id, name, hex, role: "primary" as const, signature: false });

describe("palette validation", () => {
  it("rejects invalid hex, duplicate colours, duplicate and empty names", () => {
    const errors = validatePalette([c("a", "Stone", "#CFC6B8"), c("b", "Bad", "#XYZ"), c("d", "Copy", "#cfc6b8"), c("e", "stone", "#111111"), c("f", " ", "#222222")]);
    expect(errors.a).toBeUndefined();
    expect(errors.b).toMatch(/hex/);
    expect(errors.d).toMatch(/Duplicate colour/);
    expect(errors.e).toMatch(/Duplicate name/);
    expect(errors.f).toMatch(/Name required/);
  });
});
