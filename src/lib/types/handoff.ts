// Phase 5 domain: conceptual try-on and preliminary technical briefs.
import type { ConceptSnapshot, ID, ISODate } from "./domain";

// ── Try-on ─────────────────────────────────────────────────────
export type FitPose = "standing" | "walking" | "three_quarter";
export type FitBackground = "paper" | "stone" | "ink";

/** Original schematic avatar. Not a real person; no photograph involved. */
export interface FitModel {
  id: ID;
  name: string;
  poses: FitPose[];
  view: "front";
  /** Plain description of the drawing, e.g. proportions. Never a real identity. */
  representation: string;
  provenance: string;
  usageRights: string;
}

export const TRY_ON_LABEL = "Conceptual fitting preview — simulated, not physically accurate";

export interface TryOnPreview {
  id: ID;
  orgId: ID;
  conceptId: ID;
  versionId: ID;
  versionNumber: number;
  modelId: ID;
  pose: FitPose;
  background: FitBackground;
  /** Optional garment colour override (hex); null keeps the version palette. */
  colour: string | null;
  garment: Pick<ConceptSnapshot, "title" | "silhouette" | "palette" | "seed">;
  jobId: ID | null;
  label: typeof TRY_ON_LABEL;
  provenance: string;
  saved: boolean;
  createdAt: ISODate;
}

// ── Technical handoff ──────────────────────────────────────────
export type TechStatus = "draft" | "ready_for_review" | "changes_requested" | "reviewed";
export type LengthUnit = "cm" | "in";

/** Values are stored in centimetres; the UI converts for display. null = not specified. */
export interface Measurement {
  id: ID;
  name: string;
  valueCm: number | null;
  toleranceCm: number | null;
  notes: string;
  required: boolean;
  /** True when the value is an illustrative placeholder, not a measured spec. */
  illustrative: boolean;
}

export type BomStatus = "unspecified" | "proposed" | "confirmed";

export interface BomLine {
  id: ID;
  component: string;
  material: string;
  colour: string;
  quantity: number | null;
  unit: string;
  supplierNotes: string;
  status: BomStatus;
}

export const CONSTRUCTION_FIELDS = [
  ["description", "Garment description"],
  ["constructionNotes", "Construction notes"],
  ["closure", "Closure type"],
  ["neckline", "Collar / neckline"],
  ["sleeves", "Sleeve details"],
  ["pockets", "Pocket details"],
  ["hem", "Hem details"],
  ["stitching", "Stitching notes"],
  ["trims", "Trim requirements"],
  ["fabricRecommendations", "Fabric recommendations"],
  ["finishing", "Finishing notes"],
] as const;
export type ConstructionKey = (typeof CONSTRUCTION_FIELDS)[number][0];

export interface TechReview {
  id: ID;
  from: TechStatus;
  to: TechStatus;
  note: string;
  actor: string;
  at: ISODate;
}

export interface TechBrief {
  id: ID;
  orgId: ID;
  conceptId: ID;
  versionId: ID;
  versionNumber: number;
  status: TechStatus;
  construction: Record<ConstructionKey, string>;
  /** Which construction fields were prefilled from concept metadata (not verified specs). */
  prefilled: ConstructionKey[];
  measurements: Measurement[];
  bom: BomLine[];
  displayUnit: LengthUnit;
  reviews: TechReview[];
  createdAt: ISODate;
  updatedAt: ISODate;
}
