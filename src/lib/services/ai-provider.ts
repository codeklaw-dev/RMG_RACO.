// Provider-independent AI contract. The demo adapter and future real
// adapters (ComfyUI, Diffusers/FLUX, FASHN, VLMs) all implement this.
// Real adapters run server-side only — never import secrets into client code.
import { z } from "zod";
import type { TryOnPreview } from "@/lib/types/handoff";
import {
  GARMENT_CATEGORIES,
  MATERIALS,
  SILHOUETTES,
  type CapabilityState,
  type Concept,
  type ConceptVersion,
  type GenerationJob,
  type ID,
} from "@/lib/types/domain";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours must be 6-digit hex");

/**
 * Brand conditioning attached to Brand/Hybrid requests, built only from an
 * APPROVED profile version by `buildBrandContext()` in lib/brand/intelligence.ts.
 * Pilot extensions (retrieved embeddings, LoRA adapter id, consistency
 * thresholds) add optional fields here without changing call sites.
 */
export const brandContextSchema = z.object({
  profileId: z.string().min(1),
  version: z.number().int().positive(),
  approved: z.literal(true, { message: "Only approved brand profiles can condition generation" }),
  palette: z.array(hex).max(16),
  signaturePalette: z.array(hex).default([]),
  paletteOnly: z.boolean().default(false),
  avoidColours: z.array(hex).default([]),
  preferredSilhouettes: z.array(z.enum(SILHOUETTES)).default([]),
  avoidSilhouettes: z.array(z.enum(SILHOUETTES)).default([]),
  preferredMaterials: z.array(z.enum(MATERIALS)).default([]),
  avoidMaterials: z.array(z.enum(MATERIALS)).default([]),
  preferredDetails: z.array(z.string()).default([]),
  avoidDetails: z.array(z.string()).default([]),
  styleRuleIds: z.array(z.string()),
  negativeRuleIds: z.array(z.string()),
  /** Titles of guidance-only rules: passed as text, never scored. */
  guidance: z.array(z.string()).default([]),
  /** Approved + available brand references (metadata ids only). */
  referenceIds: z.array(z.string()).default([]),
  /** 1 = follow brand strictly. */
  strictness: z.number().min(0).max(1).default(0.9),
  /** 0 = pure brand, 1 = ignore brand. Always 1 − strictness. */
  explorationWeight: z.number().min(0).max(1),
});
export type BrandContext = z.infer<typeof brandContextSchema>;
export type BrandContextInput = z.input<typeof brandContextSchema>;

export const generateRequestSchema = z
  .object({
    orgId: z.string().min(1),
    prompt: z.string().trim().min(3, "Describe the garment in a few words").max(2000),
    category: z.enum(GARMENT_CATEGORIES),
    silhouette: z.enum(SILHOUETTES),
    materials: z.array(z.enum(MATERIALS)).min(1, "Choose at least one material").max(3),
    palette: z.array(hex).max(4).default([]),
    mode: z.enum(["explore", "brand", "hybrid"]),
    brandProfileVersion: z.number().int().positive().nullable(),
    brandContext: brandContextSchema.nullable().default(null),
    targetCollectionId: z.string().nullable().default(null),
    referenceAssetIds: z.array(z.string()).max(6).default([]),
    count: z.number().int().min(2).max(4).default(4),
    creativity: z.number().min(0).max(1).default(0.5),
    seed: z.number().int().min(0).max(2 ** 31 - 1),
    /** Set when requesting a variation; links results to the source concept. */
    variationOf: z.string().nullable().default(null),
    /** Demo-only switch to show failure + retry handling. Ignored by real adapters. */
    simulateFailure: z.boolean().default(false),
    idempotencyKey: z.string().min(8),
  })
  .refine((r) => r.mode === "explore" || r.brandContext !== null, {
    message: "Brand and Hybrid modes require an approved brand profile",
    path: ["brandContext"],
  })
  .refine((r) => r.mode !== "explore" || r.brandContext === null, {
    message: "Explore mode must not carry brand context",
    path: ["brandContext"],
  });
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type GenerateRequestInput = z.input<typeof generateRequestSchema>;

const unit = z.number().min(0).max(1);
export const regionSchema = z.object({ x: unit, y: unit, w: unit.refine((v) => v > 0), h: unit.refine((v) => v > 0) });

export const editRequestSchema = z.object({
  orgId: z.string().min(1),
  conceptId: z.string().min(1),
  parentVersionId: z.string().min(1),
  instruction: z.string().trim().min(3, "Describe the change").max(1000),
  /** Selected canvas region (normalised). Real adapters turn this into a mask. */
  region: regionSchema.nullable().default(null),
  maskAssetId: z.string().nullable().default(null),
  /** State of the parent version; the demo adapter edits this, real adapters edit the image. */
  base: z.object({
    title: z.string(),
    silhouette: z.enum(SILHOUETTES),
    palette: z.array(z.object({ name: z.string(), hex })),
    fabrics: z.array(z.string()),
    details: z.array(z.string()).optional(),
    description: z.string(),
    seed: z.number().nullable(),
  }),
  idempotencyKey: z.string().min(8),
});
export type EditRequest = z.infer<typeof editRequestSchema>;
export type EditRequestInput = z.input<typeof editRequestSchema>;

export interface BrandAnalysisRequest {
  orgId: ID;
  brandProfileId: ID;
  assetIds: ID[];
}

// ── Virtual try-on contract ──────────────────────────────────
// The demo adapter composes a schematic preview. A future provider (FASHN,
// IDM-VTON, CatVTON… subject to licence review) receives the same request,
// with garment/model asset ids resolved to private storage on the server.

/** Garment input: a concept version and (in production) its rendered image asset. */
export interface GarmentAsset {
  conceptId: ID;
  versionId: ID;
  imageAssetId: ID | null;
  category: string;
}

/** Model input: an avatar or a consented model photograph in production. */
export interface ModelAsset {
  modelId: ID;
  imageAssetId: ID | null;
  consent: "not_required_schematic" | "granted";
}

export interface PoseReference {
  pose: "standing" | "walking" | "three_quarter";
  keypointsAssetId?: ID | null;
}

export const tryOnRequestSchema = z.object({
  orgId: z.string().min(1),
  conceptId: z.string().min(1),
  versionId: z.string().min(1),
  modelId: z.string().min(1),
  pose: z.enum(["standing", "walking", "three_quarter"]),
  background: z.enum(["paper", "stone", "ink"]),
  colour: hex.nullable().default(null),
  garment: z.object({
    title: z.string(),
    silhouette: z.enum(SILHOUETTES),
    palette: z.array(z.object({ name: z.string(), hex })).min(1, "The garment has no colours to preview"),
    seed: z.number().nullable(),
  }),
  /** Usage rights for the model asset were confirmed (schematic avatars: rights held by RACO). */
  consentConfirmed: z.literal(true, { message: "Confirm model usage rights before generating" }),
  idempotencyKey: z.string().min(8),
});
export type TryOnRequest = z.input<typeof tryOnRequestSchema>;

export type TryOnErrorCode = "validation" | "model_unavailable" | "garment_unsupported" | "timeout" | "provider_unavailable";

export interface JobRef {
  jobId: ID;
}

export interface ProviderInfo {
  id: string;
  label: string;
  capability: CapabilityState;
}

export interface AIProvider {
  readonly info: ProviderInfo;
  generateConcepts(req: GenerateRequestInput): Promise<JobRef>;
  editConcept(req: EditRequestInput): Promise<JobRef>;
  analyzeBrand(req: BrandAnalysisRequest): Promise<JobRef>;
  virtualTryOn(req: TryOnRequest): Promise<JobRef>;
  getJob(jobId: ID): Promise<GenerationJob>;
  /** Concepts produced by a succeeded job. Empty for any other state. */
  getResults(jobId: ID): Promise<Concept[]>;
  /** Preview produced by a succeeded try-on job; null otherwise. */
  getTryOnResult(jobId: ID): Promise<TryOnPreview | null>;
  /** New version produced by a succeeded edit job; null otherwise. */
  getEditResult(jobId: ID): Promise<ConceptVersion | null>;
  cancelJob(jobId: ID): Promise<void>;
  /** Re-queue a failed or canceled job with the same request. */
  retryJob(jobId: ID): Promise<void>;
}

export class ProviderError extends Error {
  constructor(
    public code: "validation" | "not_found" | "timeout" | "provider_unavailable" | "canceled" | "invalid_transition",
    message: string,
  ) {
    super(message);
  }
}
