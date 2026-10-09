import { describe, expect, it } from "vitest";
import { BRAND_VERSIONS } from "@/lib/fixtures";
import { approve, approvedVersion, discardDraft, editDraft, restoreAsDraft, returnToDraft, submitForReview, workingVersion } from "./versioning";

const toggleOversized = (vs = BRAND_VERSIONS) =>
  editDraft(vs, (c) => ({ ...c, rules: c.rules.map((r) => (r.id === "n_oversized" ? { ...r, enabled: true } : r)) }));

describe("brand versioning", () => {
  it("editing an approved profile creates a draft and leaves the approved snapshot untouched", () => {
    const before = structuredClone(approvedVersion(BRAND_VERSIONS));
    const { versions, draft, created } = toggleOversized();
    expect(created).toBe(true);
    expect(draft).toMatchObject({ version: 4, status: "draft", basedOnVersion: 3 });
    expect(approvedVersion(versions)).toEqual(before);
    expect(draft.content.rules.find((r) => r.id === "n_oversized")?.enabled).toBe(true);
  });

  it("reuses the open draft for further edits", () => {
    const first = toggleOversized();
    const second = editDraft(first.versions, (c) => ({ ...c, name: "Serein" }));
    expect(second.created).toBe(false);
    expect(second.versions.filter((v) => v.status === "draft")).toHaveLength(1);
  });

  it("runs draft → in review → approved and archives the previous approval", () => {
    let vs = submitForReview(toggleOversized().versions);
    expect(workingVersion(vs)?.status).toBe("in_review");
    expect(() => editDraft(vs, (c) => c)).toThrow(/in review/);
    vs = approve(vs, "tester");
    expect(approvedVersion(vs)?.version).toBe(4);
    expect(vs.find((v) => v.version === 3)?.status).toBe("archived");
    expect(approvedVersion(vs)?.content.rules.every((r) => r.approval === "approved")).toBe(true);
  });

  it("only approves versions in review", () => {
    expect(() => approve(toggleOversized().versions, "x")).toThrow(/in review/);
  });

  it("returns to draft, discards, and restores into a new draft", () => {
    const inReview = submitForReview(toggleOversized().versions);
    expect(workingVersion(returnToDraft(inReview))?.status).toBe("draft");
    expect(workingVersion(discardDraft(returnToDraft(inReview)))).toBeNull();
    const { versions, draft } = restoreAsDraft(BRAND_VERSIONS, 1);
    expect(draft).toMatchObject({ status: "draft", basedOnVersion: 1, version: 4 });
    expect(draft.content).toEqual(BRAND_VERSIONS[0].content);
    expect(versions.find((v) => v.version === 1)?.status).toBe("archived");
  });
});
