import { beforeEach, describe, expect, it } from "vitest";
import { evaluateConcept } from "@/lib/brand/intelligence";
import { BRAND_PROFILE, CONCEPTS } from "@/lib/fixtures";
import { applyEdit, parseInstruction } from "@/lib/services/demo-edit";
import { migrateState, useStudioStore } from "@/lib/store/studio-store";
import { versionsOf } from "./versions";

const C = CONCEPTS[2]; // cpt_03, tailoring, draft
const st = () => useStudioStore.getState();
const own = () => versionsOf(st().versions, C.id);
const head = () => st().versions.find((v) => v.id === st().concepts.find((c) => c.id === C.id)!.currentVersionId)!;

beforeEach(() => {
  localStorage.clear();
  st().reset();
});

describe("versions", () => {
  it("every concept starts with an original v1", () => {
    expect(own()).toHaveLength(1);
    expect(own()[0]).toMatchObject({ number: 1, parentId: null, operation: "generate" });
  });

  it("saving a revision appends v2 and keeps v1 byte-for-byte", () => {
    const v1 = structuredClone(own()[0]);
    const res = st().saveRevision(C.id, { ...head().snapshot, silhouette: "fitted", notes: "Narrow the shoulder" });
    expect(res.ok).toBe(true);
    expect(own().map((v) => v.number)).toEqual([1, 2]);
    expect(own()[0]).toEqual(v1);
    expect(own()[1]).toMatchObject({ parentId: v1.id, operation: "manual", brandProfileVersion: C.brandProfileVersion });
    expect(own()[1].changes.map((c) => c.attribute)).toEqual(expect.arrayContaining(["silhouette", "notes"]));
    expect(st().concepts.find((c) => c.id === C.id)).toMatchObject({ silhouette: "fitted", currentVersionId: own()[1].id });
  });

  it("rejects no-op saves and edits to approved concepts", () => {
    expect(st().saveRevision(C.id, head().snapshot)).toEqual({ ok: false, error: "No changes to save" });
    st().review(C.id, "submit");
    st().review(C.id, "approve");
    expect(st().saveRevision(C.id, { ...head().snapshot, silhouette: "fitted" }).ok).toBe(false);
  });

  it("refuses to append a version with an id that already exists", () => {
    expect(st().addVersion({ ...own()[0] }).ok).toBe(false);
  });

  it("restores an earlier version as a NEW head version", () => {
    st().saveRevision(C.id, { ...head().snapshot, silhouette: "fitted" });
    const v1 = own()[0];
    const res = st().restoreVersion(C.id, v1.id);
    expect(res.ok).toBe(true);
    expect(own().map((v) => v.operation)).toEqual(["generate", "manual", "restore"]);
    expect(own()[2]).toMatchObject({ number: 3, parentId: own()[1].id, snapshot: v1.snapshot });
    expect(st().restoreVersion(C.id, own()[2].id).ok).toBe(false);
  });

  it("a variation creates a related concept; a revision does not", () => {
    const before = st().concepts.length;
    st().saveRevision(C.id, { ...head().snapshot, silhouette: "relaxed" });
    expect(st().concepts.length).toBe(before);
    const id = st().duplicateFromVersion(C.id, own()[1].id)!;
    expect(st().concepts.length).toBe(before + 1);
    const v = st().concepts.find((c) => c.id === id)!;
    expect(v).toMatchObject({ parentConceptId: C.id, silhouette: "relaxed", status: "draft", collectionId: null });
    expect(versionsOf(st().versions, id)).toHaveLength(1);
    expect(own()).toHaveLength(2);
  });
});

describe("annotations", () => {
  it("are tied to a version, clamped, and persisted", () => {
    const res = st().addAnnotation({ conceptId: C.id, versionId: own()[0].id, x: 1.4, y: 0.25, text: " Reduce shoulder width ", category: "fit", view: "front" });
    expect(res.ok).toBe(true);
    const a = st().annotations[0];
    expect(a).toMatchObject({ x: 1, y: 0.25, text: "Reduce shoulder width", resolved: false, orgId: C.orgId });
    st().updateAnnotation(a.id, { resolved: true, text: "Done" });
    const saved = JSON.parse(localStorage.getItem("raco-studio")!).state.annotations;
    expect(saved[0]).toMatchObject({ resolved: true, text: "Done", versionId: own()[0].id });
    st().deleteAnnotation(a.id);
    expect(st().annotations).toEqual([]);
  });
  it("reject empty comments and unknown versions", () => {
    expect(st().addAnnotation({ conceptId: C.id, versionId: own()[0].id, x: 0.5, y: 0.5, text: " ", category: "fit", view: "front" }).ok).toBe(false);
    expect(st().addAnnotation({ conceptId: C.id, versionId: "nope", x: 0.5, y: 0.5, text: "x", category: "fit", view: "front" }).ok).toBe(false);
  });
});

describe("brand alignment recalculation", () => {
  it("re-scores a revised version without touching the original's record", () => {
    const base = head().snapshot;
    const { changes } = parseInstruction("Use denim instead of wool", base);
    const revised = applyEdit(base, changes, "Use denim instead of wool");
    const before = evaluateConcept({ ...C, ...base }, BRAND_PROFILE.content);
    const after = evaluateConcept({ ...C, ...revised }, BRAND_PROFILE.content);
    const synth = (r: typeof before) => r.checks.find((c) => c.ruleId === "n_synthetic")!.result;
    expect(synth(before)).toBe("pass");
    expect(synth(after)).toBe("fail");
    expect(after.score!).toBeLessThan(before.score!);
    expect(after.checks.some((c) => c.result === "not_evaluated")).toBe(true); // guidance rules stay unscored
  });
  it("records documented exceptions without changing the brand profile", () => {
    const rules = structuredClone(BRAND_PROFILE.content.rules);
    const res = st().addException({ conceptId: C.id, versionId: own()[0].id, ruleId: "n_synthetic", brandProfileVersion: 3, reason: "Client-requested technical capsule" });
    expect(res.ok).toBe(true);
    expect(st().addException({ conceptId: C.id, versionId: own()[0].id, ruleId: "n_synthetic", brandProfileVersion: 3, reason: " " }).ok).toBe(false);
    expect(BRAND_PROFILE.content.rules).toEqual(rules);
  });
});

describe("review workflow", () => {
  it("records history and reopens a rejection as a new draft version", () => {
    st().review(C.id, "submit", "Ready");
    st().review(C.id, "reject", "Too wide");
    expect(st().concepts.find((c) => c.id === C.id)!.status).toBe("rejected");
    const res = st().review(C.id, "reopen");
    expect(res.ok && res.value).toBeTruthy();
    expect(own().at(-1)).toMatchObject({ operation: "reopen", number: 2 });
    expect(st().reviews.map((r) => r.to)).toEqual(["draft", "rejected", "in_review"]);
    expect(st().review(C.id, "approve").ok).toBe(false);
  });
});

describe("collections", () => {
  it("adds, reorders (including keyboard moves) and removes looks", () => {
    const col = "col_resort";
    const ids = () => st().collections.find((c) => c.id === col)!.conceptIds;
    expect(st().saveToCollection(C.id, col)).toEqual({ ok: true });
    expect(st().saveToCollection(C.id, col)).toEqual({ ok: false, reason: "duplicate" });
    const original = [...ids()];
    st().moveLook(col, original[0], 1);
    expect(ids().slice(0, 2)).toEqual([original[1], original[0]]);
    st().moveLook(col, ids()[0], -1); // already first: no-op
    expect(ids().slice(0, 2)).toEqual([original[1], original[0]]);
    st().reorderLooks(col, [...original].reverse());
    expect(ids()).toEqual([...original].reverse());
    st().reorderLooks(col, ["bogus"]);
    expect(ids()).toEqual([...original].reverse());
    st().removeFromCollection(col, C.id);
    expect(ids()).not.toContain(C.id);
  });
  it("stores collection notes, direction, groups and look meta", () => {
    st().updateCollection("col_aw26", { creativeDirection: "Narrow shoulders", notes: "Line review Thursday" });
    const g = st().addGroup("col_aw26", "Evening");
    expect(g.ok).toBe(true);
    st().setLookMeta("col_aw26", "cpt_01", { note: "Hero look", groupId: g.ok ? g.value : null });
    st().removeGroup("col_aw26", g.ok ? g.value : "");
    const col = st().collections.find((c) => c.id === "col_aw26")!;
    expect(col).toMatchObject({ creativeDirection: "Narrow shoulders", notes: "Line review Thursday" });
    expect(col.lookMeta!.cpt_01).toMatchObject({ note: "Hero look", groupId: null });
  });
});

describe("organisation isolation", () => {
  it("blocks cross-organisation collection saves", () => {
    st().addConcepts([{ ...C, id: "foreign_1", orgId: "org_other", currentVersionId: "foreign_1_v1" }]);
    expect(st().saveToCollection("foreign_1", "col_aw26")).toEqual({ ok: false, reason: "forbidden" });
  });
  it("stamps annotations with the concept's organisation", () => {
    st().addConcepts([{ ...C, id: "foreign_2", orgId: "org_other", currentVersionId: "foreign_2_v1" }]);
    st().addAnnotation({ conceptId: "foreign_2", versionId: "foreign_2_v1", x: 0.1, y: 0.1, text: "x", category: "fit", view: "front" });
    expect(st().annotations[0].orgId).toBe("org_other");
  });
});

describe("persistence migration to v5", () => {
  it("upgrades a v3 payload: statuses, versions, preserved edits, dropped orphans", () => {
    const edited = { ...CONCEPTS[0], title: "Renamed wrap coat", status: "shortlisted", favorite: true };
    const migrated = migrateState({
      concepts: [edited, ...CONCEPTS.slice(1)],
      collections: [{ id: "col_aw26", conceptIds: ["cpt_02", "cpt_01", "ghost"] }],
      annotations: [{ id: "a1", versionId: "missing" }],
    });
    const c = migrated.concepts.find((x) => x.id === "cpt_01")!;
    expect(c).toMatchObject({ title: "Renamed wrap coat", status: "in_review", favorite: true });
    expect(migrated.versions.filter((v) => v.conceptId === "cpt_01")).toHaveLength(1);
    expect(migrated.collections.find((x) => x.id === "col_aw26")!.conceptIds).toEqual(["cpt_02", "cpt_01"]);
    expect(migrated.annotations).toEqual([]);
    expect(migrated.reviews).toEqual([]);
  });
});
