import { describe, expect, it } from "vitest";
import { makeRequest } from "@/test/factories";
import { generateRequestSchema } from "./ai-provider";

const parse = (r: unknown) => generateRequestSchema.safeParse(r);

describe("generateRequestSchema", () => {
  it("accepts a complete request in each mode", () => {
    for (const mode of ["explore", "brand", "hybrid"] as const) {
      expect(parse(makeRequest({ mode })).success).toBe(true);
    }
  });

  it("rejects short prompts, empty materials, bad colours and out-of-range counts", () => {
    expect(parse(makeRequest({ prompt: "a" })).success).toBe(false);
    expect(parse(makeRequest({ materials: [] })).success).toBe(false);
    expect(parse(makeRequest({ palette: ["red"] })).success).toBe(false);
    expect(parse(makeRequest({ count: 5 })).success).toBe(false);
    expect(parse(makeRequest({ count: 1 })).success).toBe(false);
  });

  it("requires brand context for Brand/Hybrid and forbids it for Explore", () => {
    expect(parse(makeRequest({ mode: "brand" }, { brandContext: null })).success).toBe(false);
    const brand = makeRequest({ mode: "brand" });
    expect(parse({ ...makeRequest({ mode: "explore" }), brandContext: brand.brandContext }).success).toBe(false);
  });
});
