// Provider-independent AI contract. The demo adapter and future real
// adapters (ComfyUI, Diffusers/FLUX, FASHN, VLMs) all implement this.
// Real adapters run server-side only — never import secrets into client code.
import { z } from "zod";
import {
  GARMENT_CATEGORIES,
  MATERIALS,
  SILHOUETTES,
  type CapabilityState,
  type Concept,
  type GenerationJob,
  type ID,
} from "@/lib/types/domain";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours must be 6-digit hex");

/**
 * Brand conditioning attached to Brand/Hybrid requests.
 * Phase 2 fills profile id/version, palette and rule ids from the fixture profile.
 * Phase 3 extends this object (retrieved references, approval state, consistency
 * constraints) without changing the Studio's request assembly call site.
 */
export const brandContextSchema = z.object({
  profileId: z.string().min(1),
  version: z.number().int().positive(),
  approved: z.boolean(),
  palette: z.array(hex).max(8),
  styleRuleIds: z.array(z.string()),
  negativeRuleIds: z.array(z.string()),
  /** 0 = pure brand, 1 = ignore brand. Brand mode 0.2, Hybrid 0.5. */
  explorationWeight: z.number().min(0).max(1),
});
export type BrandContext = z.infer<typeof brandContextSchema>;

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
    message: "Brand and Hybrid modes require a brand context",
    path: ["brandContext"],
  })
  .refine((r) => r.mode !== "explore" || r.brandContext === null, {
    message: "Explore mode must not carry brand context",
    path: ["brandContext"],
  });
export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type GenerateRequestInput = z.input<typeof generateRequestSchema>;

export const editRequestSchema = z.object({
  orgId: z.string().min(1),
  conceptId: z.string().min(1),
  parentVersionId: z.string().min(1),
  instruction: z.string().trim().min(3).max(1000),
  maskAssetId: z.string().nullable().default(null),
  idempotencyKey: z.string().min(8),
});
export type EditRequest = z.infer<typeof editRequestSchema>;

export interface BrandAnalysisRequest {
  orgId: ID;
  brandProfileId: ID;
  assetIds: ID[];
}

export interface TryOnRequest {
  orgId: ID;
  garmentAssetId: ID;
  modelAssetId: ID;
  consentConfirmed: true;
}

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
  editConcept(req: EditRequest): Promise<JobRef>;
  analyzeBrand(req: BrandAnalysisRequest): Promise<JobRef>;
  virtualTryOn(req: TryOnRequest): Promise<JobRef>;
  getJob(jobId: ID): Promise<GenerationJob>;
  /** Concepts produced by a succeeded job. Empty for any other state. */
  getResults(jobId: ID): Promise<Concept[]>;
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
