// Brand DNA domain. Reuses the garment/silhouette/material taxonomies from domain.ts.
import type { GarmentCategory, ID, ISODate, Material, Silhouette } from "./domain";

export type ProfileStatus = "draft" | "in_review" | "approved" | "archived";
export type RuleKind = "positive" | "negative";
export type RuleCategory = "silhouette" | "material" | "colour" | "construction" | "branding" | "general";
export type RulePriority = "high" | "medium" | "low";
export type ItemApproval = "approved" | "pending";

/**
 * The machine-checkable part of a rule. Only these effects are evaluated;
 * `guidance` rules are carried into the request as text and never scored.
 * No semantic understanding beyond these structured checks is claimed.
 */
export type RuleEffect =
  | { type: "prefer_silhouette"; values: Silhouette[] }
  | { type: "avoid_silhouette"; values: Silhouette[] }
  | { type: "prefer_material"; values: Material[] }
  | { type: "avoid_material"; values: Material[] }
  | { type: "prefer_detail"; values: string[] }
  | { type: "avoid_detail"; values: string[] }
  | { type: "avoid_colour"; values: string[] } // hex
  | { type: "palette_only" }
  | { type: "guidance" };

export interface BrandRule {
  id: ID;
  kind: RuleKind;
  title: string;
  description: string;
  category: RuleCategory;
  priority: RulePriority;
  enabled: boolean;
  approval: ItemApproval;
  effect: RuleEffect;
  sourceReferenceIds: ID[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface BrandColour {
  id: ID;
  name: string;
  hex: string;
  role: "primary" | "secondary";
  signature: boolean;
}

export interface BrandIdentity {
  personality: string;
  creativeDirection: string;
  targetAudience: string;
  keywords: string[];
  categories: GarmentCategory[];
  silhouettes: Silhouette[];
  signatureElements: string[];
  seasonalInfluences: string[];
}

export interface BrandMaterials {
  preferred: Material[];
  restricted: Material[];
  constructionDetails: string[];
  notes: string;
  sustainability: string;
  seasonal: { autumnWinter: Material[]; springSummer: Material[] };
}

/** Everything a version snapshots. Approved snapshots are never mutated. */
export interface BrandDNA {
  name: string;
  description: string;
  positioning: string;
  identity: BrandIdentity;
  palette: BrandColour[];
  materials: BrandMaterials;
  rules: BrandRule[];
}

export interface BrandProfileVersion {
  id: ID;
  orgId: ID;
  profileId: ID;
  version: number;
  status: ProfileStatus;
  content: BrandDNA;
  basedOnVersion: number | null;
  note: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  submittedAt: ISODate | null;
  approvedAt: ISODate | null;
  /** Demo label only: approval is a simulated authorised action, not real auth. */
  approvedBy: string | null;
}

export type ReferenceCategory = "archive" | "moodboard" | "sketch" | "fabric" | "detail";

/** Metadata only. Image bytes live in an in-tab object URL and are never persisted. */
export interface BrandReference {
  id: ID;
  orgId: ID;
  title: string;
  description: string;
  category: ReferenceCategory;
  tags: string[];
  source: string;
  rightsConfirmed: boolean;
  approval: ItemApproval;
  fileName: string | null;
  fileSize: number | null;
  fileType: string | null;
  createdAt: ISODate;
}

export interface BrandChange {
  id: ID;
  at: ISODate;
  version: number;
  action: "created_draft" | "edited" | "submitted" | "returned" | "approved" | "restored" | "discarded";
  summary: string;
}
