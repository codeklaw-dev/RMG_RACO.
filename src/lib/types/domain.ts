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

export interface LookMeta {
  note: string;
  tags: string[];
  groupId?: ID | null;
}

/** Design direction section within a collection board. */
export interface CollectionGroup {
  id: ID;
  name: string;
}

export type AnnotationCategory = "fit" | "construction" | "material" | "colour" | "detail" | "general";

/** Pin on a specific concept version, in normalised (0–1) canvas coordinates. */
export interface DesignAnnotation {
  id: ID;
  orgId: ID;
  conceptId: ID;
  versionId: ID;
  x: number;
  y: number;
  view: "front" | "back";
  text: string;
  category: AnnotationCategory;
  resolved: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** One review transition on a concept (simulated local action in the demo). */
export interface DesignReview {
  id: ID;
  conceptId: ID;
  versionId: ID;
  from: ConceptStatus;
  to: ConceptStatus;
  note: string;
  actor: string;
  at: ISODate;
}

/** A designer knowingly overriding a brand rule, with a reason. The profile is not changed. */
export interface BrandException {
  id: ID;
  conceptId: ID;
  versionId: ID;
  ruleId: ID;
  brandProfileVersion: number;
  reason: string;
  at: ISODate;
}

export type CollectionStatus = "concept" | "in_review" | "approved" | "archived";

export interface Collection {
  id: ID;
  orgId: ID;
  name: string;
  season: Season;
  status: CollectionStatus;
  description: string;
  /** Ordered look ids. Order is the presentation order. */
  conceptIds: ID[];
  /** Per-look notes and tags, scoped to this collection. */
  lookMeta?: Record<ID, LookMeta>;
  creativeDirection?: string;
  notes?: string;
  groups?: CollectionGroup[];
  updatedAt: ISODate;
}

/** Concept review status — separate from Brand DNA and collection approval. */
export type ConceptStatus = "draft" | "in_review" | "approved" | "rejected" | "archived";

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
  /** Construction details from the controlled vocabulary (lib/brand/vocabulary). */
  details?: string[];
  /** Designer tags and creative notes (metadata only; not rendered). */
  tags?: string[];
  notes?: string;
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

/**
 * generate = original · edit = conversational refinement · manual = property edit
 * restore = copy of an earlier version · reopen = new draft after rejection
 */
export type VersionOperation = "generate" | "edit" | "manual" | "restore" | "reopen" | "variation" | "try_on";

/** The visual + descriptive state a version captures. Concepts mirror their current version. */
export type ConceptSnapshot = Pick<Concept, "title" | "silhouette" | "palette" | "fabrics" | "details" | "description" | "seed" | "tags" | "notes">;

/** Normalised (0–1) rectangle on the canvas. */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VersionChange {
  attribute: "silhouette" | "material" | "colour" | "accent" | "detail" | "title" | "description" | "tags" | "notes";
  from: string;
  to: string;
}

/**
 * Immutable once created. A revision is a new version of the same concept;
 * a variation is a different concept linked by Concept.parentConceptId.
 */
export interface ConceptVersion {
  id: ID;
  conceptId: ID;
  parentId: ID | null;
  /** 1-based, sequential per concept. */
  number: number;
  summary: string;
  /** Brand DNA version that generated the concept; inherited, never rewritten. */
  brandProfileVersion: number | null;
  provenance: string;
  imageAssetId: ID;
  operation: VersionOperation;
  instruction: string;
  region: Region | null;
  changes: VersionChange[];
  snapshot: ConceptSnapshot;
  capability: CapabilityState;
  jobId: ID | null;
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
