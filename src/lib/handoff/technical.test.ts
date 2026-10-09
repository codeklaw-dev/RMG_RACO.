import { describe, expect, it } from "vitest";
import { CONCEPTS } from "@/lib/fixtures";
import { DEMO_BRIEFS, DEMO_VERSIONS } from "@/lib/fixtures/demo";
import { originalVersion } from "@/lib/editor/versions";
import {
  BRIEF_DISCLAIMER, BRIEF_TITLE, buildBriefDocument, createBrief, fromDisplay, missingInfo, techActions, techTransition, toDisplay, validateMeasurement,
} from "./technical";
import { renderBriefPdf } from "./pdf";

const concept = CONCEPTS[0];
const version = originalVersion(concept);

describe("technical brief creation", () => {
  it("prefills only from recorded concept metadata and leaves measurements blank", () => {
    const b = createBrief(concept, version);
    expect(b).toMatchObject({ conceptId: concept.id, versionId: version.id, versionNumber: 1, status: "draft", orgId: concept.orgId });
    expect(b.prefilled).toEqual(expect.arrayContaining(["description", "fabricRecommendations"]));
    expect(b.construction.sleeves).toBe("");
    expect(b.construction.pockets).toBe("");
    expect(b.measurements.every((m) => m.valueCm === null && m.toleranceCm === null)).toBe(true);
    expect(b.measurements.map((m) => m.name)).toEqual(["Chest width", "Shoulder width", "Body length", "Sleeve length", "Waist width", "Hem width"]);
    expect(b.bom.find((l) => l.component === "Lining")!.status).toBe("unspecified");
  });
  it("lists missing information", () => {
    const w = missingInfo(createBrief(concept, version));
    expect(w).toEqual(expect.arrayContaining(["Measurement not specified: Chest width", "Sleeve details not specified", "Bill of materials: Lining unspecified"]));
  });
});

describe("measurements", () => {
  it("validate values and tolerances", () => {
    expect(validateMeasurement({ name: "Chest", valueCm: 52, toleranceCm: 1 })).toBeNull();
    expect(validateMeasurement({ name: "Chest", valueCm: null, toleranceCm: null })).toBeNull();
    expect(validateMeasurement({ name: "", valueCm: 52, toleranceCm: 1 })).toMatch(/Name/);
    expect(validateMeasurement({ name: "Chest", valueCm: -3, toleranceCm: null })).toMatch(/between/);
    expect(validateMeasurement({ name: "Chest", valueCm: 52, toleranceCm: -1 })).toMatch(/negative/);
    expect(validateMeasurement({ name: "Chest", valueCm: 2, toleranceCm: 3 })).toMatch(/smaller/);
  });
  it("convert between centimetres and inches", () => {
    expect(toDisplay(52, "in")).toBe(20.47);
    expect(toDisplay(2.54, "in")).toBe(1);
    expect(fromDisplay(10, "in")).toBe(25.4);
    expect(toDisplay(52.04, "cm")).toBe(52);
    expect(toDisplay(null, "in")).toBeNull();
    expect(toDisplay(fromDisplay(20, "in"), "in")).toBe(20);
  });
});

describe("technical review transitions", () => {
  it("follow draft → ready → changes requested / reviewed", () => {
    expect(techTransition("draft", "submit")).toBe("ready_for_review");
    expect(techTransition("ready_for_review", "request_changes")).toBe("changes_requested");
    expect(techTransition("changes_requested", "submit")).toBe("ready_for_review");
    expect(techTransition("ready_for_review", "mark_reviewed")).toBe("reviewed");
    expect(techTransition("reviewed", "reopen")).toBe("draft");
    expect(() => techTransition("draft", "mark_reviewed")).toThrow();
    expect(techActions("reviewed")).toEqual(["reopen"]);
  });
});

describe("export content", () => {
  const b = DEMO_BRIEFS[0];
  const v2 = DEMO_VERSIONS[0];
  const doc = buildBriefDocument(b, { concept, version: v2, collectionNames: ["Quiet Architecture"], brandVersion: 3, conceptReview: "Approved", generatedAt: "9 Oct 2026" });
  it("includes every required section, the title and the disclaimer", () => {
    expect(doc.title).toBe("Preliminary Garment Development Brief");
    expect(doc.disclaimer).toBe(BRIEF_DISCLAIMER);
    expect(doc.sections.map((s) => s.heading)).toEqual(["Garment identification", "Design overview", "Construction", "Preliminary measurements (cm)", "Materials and trims", "Review", "Provenance"]);
    const rows = Object.fromEntries(doc.sections.flatMap((s) => s.rows));
    expect(rows["Concept ID"]).toBe(concept.id);
    expect(rows["Design version"]).toContain("v2");
    expect(rows["Version provenance"]).toBe(v2.provenance);
    expect(rows["Chest width *"]).toBe("Not specified");
    expect(rows["Sleeve details"]).toBe("Not specified");
    expect(doc.warnings.length).toBeGreaterThan(0);
    expect(doc.footer).toContain("not a production tech pack");
    expect(JSON.stringify(doc)).not.toMatch(/production[- ]approved|tech pack approved/i);
  });
  it("renders a PDF containing the title and disclaimer", async () => {
    const pdf = await renderBriefPdf(doc, []);
    const raw = pdf.output();
    expect(raw.startsWith("%PDF")).toBe(true);
    expect(raw).toContain(BRIEF_TITLE);
    expect(raw).toContain("professional validation");
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
