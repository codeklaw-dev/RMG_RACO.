import { describe, expect, it } from "vitest";
import { validateReference } from "./reference-dropzone";

describe("reference validation", () => {
  it("accepts supported images within the size limit", () => {
    expect(validateReference({ type: "image/png", size: 1024 })).toBeNull();
  });
  it("rejects other types and oversized files", () => {
    expect(validateReference({ type: "application/pdf", size: 10 })).toMatch(/JPEG, PNG or WebP/);
    expect(validateReference({ type: "image/jpeg", size: 9 * 1024 * 1024 })).toMatch(/8 MB/);
  });
});
