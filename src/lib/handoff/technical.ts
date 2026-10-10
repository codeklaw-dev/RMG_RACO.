// Preliminary technical brief logic. Prefills only from recorded concept
// metadata and flags it as such; never invents measurements or specs.
import { CLOSURE_DETAILS, FINISH_DETAILS } from "@/lib/brand/vocabulary";
import type { Concept, ConceptVersion } from "@/lib/types/domain";
import {
  CONSTRUCTION_FIELDS,
  type BomLine,
  type ConstructionKey,
  type LengthUnit,
  type Measurement,
  type TechBrief,
  type TechStatus,
} from "@/lib/types/handoff";

export const BRIEF_TITLE = "Preliminary Garment Development Brief";
export const BRIEF_DISCLAIMER = "Concept-stage document. Measurements, construction, fit, and production feasibility require professional validation.";

// ── Units ──
const CM_PER_IN = 2.54;
const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
export const toDisplay = (cm: number | null, unit: LengthUnit) => (cm === null ? null : unit === "cm" ? round(cm, 1) : round(cm / CM_PER_IN, 2));
export const fromDisplay = (v: number | null, unit: LengthUnit) => (v === null ? null : unit === "cm" ? round(v, 2) : round(v * CM_PER_IN, 2));

// ── Measurements ──
export const MEASUREMENT_POINTS: [string, boolean][] = [
  ["Chest width", true],
  ["Shoulder width", true],
  ["Body length", true],
  ["Sleeve length", false],
  ["Waist width", false],
  ["Hem width", false],
];

export function validateMeasurement(m: Pick<Measurement, "name" | "valueCm" | "toleranceCm">): string | null {
  if (!m.name.trim()) return "Name the measurement point";
  if (m.valueCm !== null && (!Number.isFinite(m.valueCm) || m.valueCm <= 0 || m.valueCm > 400)) return "Value must be between 0 and 400 cm";
  if (m.toleranceCm !== null && (!Number.isFinite(m.toleranceCm) || m.toleranceCm < 0)) return "Tolerance can't be negative";
  if (m.valueCm !== null && m.toleranceCm !== null && m.toleranceCm >= m.valueCm) return "Tolerance must be smaller than the value";
  return null;
}

// ── Review workflow (separate from creative concept approval) ──
export type TechAction = "submit" | "request_changes" | "mark_reviewed" | "reopen";
const T: Record<TechAction, { from: TechStatus[]; to: TechStatus }> = {
  submit: { from: ["draft", "changes_requested"], to: "ready_for_review" },
  request_changes: { from: ["ready_for_review"], to: "changes_requested" },
  mark_reviewed: { from: ["ready_for_review"], to: "reviewed" },
  reopen: { from: ["reviewed"], to: "draft" },
};
export const TECH_STATUS_LABEL: Record<TechStatus, string> = {
  draft: "Draft", ready_for_review: "Ready for technical review", changes_requested: "Changes requested", reviewed: "Reviewed",
};
export const techActions = (s: TechStatus) => (Object.keys(T) as TechAction[]).filter((a) => T[a].from.includes(s));
export function techTransition(s: TechStatus, a: TechAction): TechStatus {
  if (!T[a].from.includes(s)) throw new Error(`Cannot ${a.replace("_", " ")} a brief that is ${TECH_STATUS_LABEL[s].toLowerCase()}`);
  return T[a].to;
}
export const isBriefEditable = (s: TechStatus) => s === "draft" || s === "changes_requested";

// ── Creation ──
let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(++seq).toString(36)}`;

export function createBrief(concept: Concept, version: ConceptVersion, now = new Date().toISOString()): TechBrief {
  const snap = version.snapshot;
  const details = snap.details ?? [];
  const closure = details.find((d) => (CLOSURE_DETAILS as readonly string[]).includes(d));
  const finish = details.find((d) => (FINISH_DETAILS as readonly string[]).includes(d));
  const construction = Object.fromEntries(CONSTRUCTION_FIELDS.map(([k]) => [k, ""])) as Record<ConstructionKey, string>;
  const prefilled: ConstructionKey[] = [];
  const fill = (k: ConstructionKey, v: string | undefined) => {
    if (v) { construction[k] = v; prefilled.push(k); }
  };
  fill("description", snap.description.replace(/ Conditioned on .*$/, "").replace(/ Revised:.*$/, ""));
  fill("closure", closure);
  fill("hem", finish);
  fill("fabricRecommendations", snap.fabrics.length ? `${snap.fabrics.join(", ")} (from concept metadata; not a sourcing decision)` : undefined);
  const bom: BomLine[] = [
    { id: uid("bom"), component: "Shell fabric", material: snap.fabrics[0] ?? "", colour: snap.palette[0]?.name ?? "", quantity: null, unit: "m", supplierNotes: "", status: snap.fabrics[0] ? "proposed" : "unspecified" },
    { id: uid("bom"), component: "Lining", material: "", colour: "", quantity: null, unit: "m", supplierNotes: "", status: "unspecified" },
    { id: uid("bom"), component: "Closure", material: closure ?? "", colour: "", quantity: null, unit: "pcs", supplierNotes: "", status: closure ? "proposed" : "unspecified" },
  ];
  return {
    id: uid("brief"),
    orgId: concept.orgId,
    conceptId: concept.id,
    versionId: version.id,
    versionNumber: version.number,
    status: "draft",
    construction,
    prefilled,
    measurements: MEASUREMENT_POINTS.map(([name, required]) => ({ id: uid("m"), name, valueCm: null, toleranceCm: null, notes: "", required, illustrative: false })),
    bom,
    displayUnit: "cm",
    reviews: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ── Completeness ──
export function missingInfo(b: TechBrief): string[] {
  const out: string[] = [];
  for (const m of b.measurements) if (m.required && m.valueCm === null) out.push(`Measurement not specified: ${m.name}`);
  for (const m of b.measurements) if (m.illustrative && m.valueCm !== null) out.push(`Illustrative value, not a specification: ${m.name}`);
  for (const [k, label] of CONSTRUCTION_FIELDS) if (!b.construction[k].trim()) out.push(`${label} not specified`);
  for (const l of b.bom) if (l.status === "unspecified") out.push(`Bill of materials: ${l.component || "line"} unspecified`);
  return out;
}

// ── Export document model (rendered to PDF by the UI) ──
export interface BriefDocument {
  title: string;
  disclaimer: string;
  sections: { heading: string; rows: [string, string][] }[];
  warnings: string[];
  footer: string;
}

const fmtLen = (cm: number | null, unit: LengthUnit) => (cm === null ? "Not specified" : `${toDisplay(cm, unit)} ${unit}`);

export function buildBriefDocument(
  b: TechBrief,
  ctx: { concept: Concept; version: ConceptVersion; collectionNames: string[]; brandVersion: number | null; conceptReview: string; generatedAt: string },
): BriefDocument {
  const { concept, version } = ctx;
  const s = version.snapshot;
  const u = b.displayUnit;
  return {
    title: BRIEF_TITLE,
    disclaimer: BRIEF_DISCLAIMER,
    sections: [
      { heading: "Garment identification", rows: [
        ["Garment", s.title], ["Concept ID", concept.id], ["Design version", `v${version.number} (${version.id})`],
        ["Collection", ctx.collectionNames.join(", ") || "Not assigned"], ["Category", concept.category], ["Silhouette", s.silhouette],
      ] },
      { heading: "Design overview", rows: [
        ["Materials", s.fabrics.join(", ") || "Not specified"], ["Palette", s.palette.map((p) => `${p.name} ${p.hex}`).join(", ")],
        ["Brand DNA version", ctx.brandVersion ? `v${ctx.brandVersion}` : "None (Explore)"], ["Designer notes", s.notes || "—"],
        ["Schematic views", "Front and back schematic illustrations (conceptual, not patterns)"],
      ] },
      { heading: "Construction", rows: CONSTRUCTION_FIELDS.map(([k, label]) => [label, b.construction[k].trim() ? b.construction[k] + (b.prefilled.includes(k) ? " [from concept metadata]" : "") : "Not specified"]) },
      { heading: `Preliminary measurements (${u})`, rows: b.measurements.map((m) => [
        `${m.name}${m.required ? " *" : ""}`,
        `${fmtLen(m.valueCm, u)}${m.toleranceCm !== null ? ` ± ${toDisplay(m.toleranceCm, u)} ${u}` : ""}${m.illustrative ? " (illustrative)" : ""}${m.notes ? ` — ${m.notes}` : ""}`,
      ]) },
      { heading: "Materials and trims", rows: b.bom.map((l) => [l.component || "—", [l.material || "material unspecified", l.colour, l.quantity !== null ? `${l.quantity} ${l.unit}` : "qty unspecified", l.status, l.supplierNotes].filter(Boolean).join(" · ")]) },
      { heading: "Review", rows: [
        ["Creative review", ctx.conceptReview], ["Technical review", TECH_STATUS_LABEL[b.status]],
        ...b.reviews.slice(0, 5).map((r): [string, string] => [new Date(r.at).toLocaleDateString("en-GB"), `${TECH_STATUS_LABEL[r.from]} → ${TECH_STATUS_LABEL[r.to]}${r.note ? `: ${r.note}` : ""} (${r.actor})`]),
      ] },
      { heading: "Provenance", rows: [["Version provenance", version.provenance], ["Concept provenance", concept.provenance], ["Generated", ctx.generatedAt]] },
    ],
    warnings: missingInfo(b),
    footer: `${BRIEF_TITLE} · ${concept.id} v${version.number} · not a production tech pack`,
  };
}
