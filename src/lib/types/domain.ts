// Core domain models. Mirrors the data contracts in the RACO spec (§05).
// Every tenant-owned record carries `orgId` so data stays logically isolated.

export type ID = string;
export type ISODate = string;

/** How truthful a capability is in the current build. */
export type CapabilityState = "live" | "simulated" | "planned";

export type Role = "owner" | "creative_director" | "designer" | "product_dev" | "viewer";

export interface Organization {
  id: ID;
  name: string;
}

export interface User {
  id: ID;
  orgId: ID;
  name: string;
  role: Role;
}

export const GARMENT_CATEGORIES = [
  "tailoring", "dress", "shirt", "trousers", "jacket", "skirt", "knitwear", "outerwear",
] as const;
export type GarmentCategory = (typeof GARMENT_CATEGORIES)[number];

export const SILHOUETTES = ["tailored", "oversized", "relaxed", "structured", "fitted", "draped"] as const;
export type Silhouette = (typeof SILHOUETTES)[number];

export const MATERIALS = ["cotton", "wool", "linen", "silk", "denim", "technical"] as const;
export type Material = (typeof MATERIALS)[number];

export type DesignMode = "explore" | "brand" | "hybrid";

export type Season = "SS27" | "AW26" | "Resort27" | "AW27";

export interface PaletteColor {
  name: string;
  hex: string;
}

export interface BrandRule {
  id: ID;
  text: string;
  /** Asset ids that justify this rule (shown as citations in the UI). */
  sourceAssetIds: ID[];
}

export interface BrandProfile {
  id: ID;
  orgId: ID;
  name: string;
  version: number;
  approved: boolean;
  summary: string;
  styleRules: BrandRule[];
  negativeRules: BrandRule[];
  palette: PaletteColor[];
  silhouettes: string[];
  fabrics: string[];
  targetCustomer: string;
  completeness: number; // 0–100
  updatedAt: ISODate;
}

export type AssetKind = "reference" | "moodboard" | "sketch" | "generated" | "model";
export type LicenseStatus = "owned" | "licensed" | "unknown" | "placeholder";
export type ConsentStatus = "not_required" | "granted" | "pending";

export interface Asset {
  id: ID;
  orgId: ID;
  kind: AssetKind;
  /** Storage key in object storage. Demo uses placeholders, so this is a token. */
  storageKey: string;
  label: string;
  licenseStatus: LicenseStatus;
  consentStatus: ConsentStatus;
  provenance: string;
}

export type CollectionStatus = "concept" | "in_review" | "approved" | "archived";

export interface Collection {
  id: ID;
  orgId: ID;
  name: string;
  season: Season;
  status: CollectionStatus;
  description: string;
  conceptIds: ID[];
  updatedAt: ISODate;
}

export type ConceptStatus = "draft" | "shortlisted" | "approved" | "rejected";

export interface Concept {
  id: ID;
  orgId: ID;
  collectionId: ID | null;
  brandProfileVersion: number | null;
  title: string;
  category: GarmentCategory;
  silhouette: Silhouette;
  description: string;
  prompt: string;
  mode: DesignMode;
  status: ConceptStatus;
  palette: PaletteColor[];
  fabrics: string[];
  favorite: boolean;
  capability: CapabilityState;
  currentVersionId: ID;
  /** Source concept when this is a variation. Originals are never overwritten. */
  parentConceptId: ID | null;
  /** Job that produced it (null for seed fixtures). */
  jobId: ID | null;
  seed: number | null;
  provenance: string;
  createdAt: ISODate;
}

export type VersionOperation = "generate" | "edit" | "variation" | "try_on";

export interface ConceptVersion {
  id: ID;
  conceptId: ID;
  parentId: ID | null;
  imageAssetId: ID;
  operation: VersionOperation;
  instruction: string;
  createdAt: ISODate;
}

export type JobType = "generate" | "edit" | "analyze_brand" | "try_on";
export type JobStatus = "draft" | "queued" | "running" | "succeeded" | "failed" | "canceled";

export interface GenerationJob {
  id: ID;
  orgId: ID;
  type: JobType;
  provider: string;
  status: JobStatus;
  progress: number; // 0–1
  label: string;
  /** Human-readable stage. For the demo adapter this is demonstration progress, not inference. */
  stage: string | null;
  attempt: number;
  errorCode: string | null;
  costEstimate: number | null; // USD, null when unknown
  resultConceptIds: ID[];
  createdAt: ISODate;
}

export interface AuditEvent {
  id: ID;
  orgId: ID;
  actorId: ID;
  action: string;
  resourceId: ID;
  timestamp: ISODate;
}
