// Provider-independent AI contract. The demo adapter and future real
// adapters (ComfyUI, Diffusers/FLUX, FASHN, VLMs) all implement this.
// Real adapters run server-side only — never import secrets into client code.
import { z } from "zod";
import type { CapabilityState, GenerationJob, ID } from "@/lib/types/domain";

export const generateRequestSchema = z.object({
  orgId: z.string().min(1),
  prompt: z.string().trim().min(3).max(2000),
  category: z.enum(["outerwear", "dress", "tailoring", "shirt", "trousers", "skirt", "knitwear"]),
  mode: z.enum(["explore", "brand", "hybrid"]),
  brandProfileVersion: z.number().int().positive().nullable(),
  referenceAssetIds: z.array(z.string()).max(8).default([]),
  count: z.number().int().min(1).max(8).default(4),
  creativity: z.number().min(0).max(1).default(0.5),
  idempotencyKey: z.string().min(8),
});
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

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
  generateConcepts(req: GenerateRequest): Promise<JobRef>;
  editConcept(req: EditRequest): Promise<JobRef>;
  analyzeBrand(req: BrandAnalysisRequest): Promise<JobRef>;
  virtualTryOn(req: TryOnRequest): Promise<JobRef>;
  getJob(jobId: ID): Promise<GenerationJob>;
  cancelJob(jobId: ID): Promise<void>;
}

export class ProviderError extends Error {
  constructor(
    public code: "validation" | "not_found" | "timeout" | "provider_unavailable" | "canceled",
    message: string,
  ) {
    super(message);
  }
}
