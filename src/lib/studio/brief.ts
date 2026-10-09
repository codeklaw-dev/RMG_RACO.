// Brief = what the designer edits. buildGenerateRequest turns it into the
// provider request. Phase 3 enriches buildBrandContext(); call sites stay put.
import { DEFAULT_STRICTNESS, buildBrandContext } from "@/lib/brand/intelligence";
import { materialsFromFabrics } from "@/lib/brand/vocabulary";
import type { GenerateRequestInput } from "@/lib/services/ai-provider";
import type { BrandProfileVersion } from "@/lib/types/brand";
import type { Concept, DesignMode, GarmentCategory, ID, Material, Silhouette } from "@/lib/types/domain";

export interface Brief {
  prompt: string;
  mode: DesignMode;
  category: GarmentCategory;
  silhouette: Silhouette;
  materials: Material[];
  palette: string[]; // hex
  targetCollectionId: ID | null;
  count: number;
  creativity: number;
  seed: number;
  simulateFailure: boolean;
  /** How closely Brand/Hybrid follow the approved profile (0–1). */
  brandStrictness: number;
  variationOf: ID | null;
  referenceIds: ID[];
}

export const MODE_DEFAULT_CREATIVITY: Record<DesignMode, number> = { explore: 0.7, brand: 0.25, hybrid: 0.5 };
export const strictnessFor = (mode: DesignMode) => (mode === "explore" ? 0 : DEFAULT_STRICTNESS[mode]);

export const MODE_COPY: Record<DesignMode, { label: string; hint: string }> = {
  explore: { label: "Explore", hint: "Original directions, no brand constraints" },
  brand: { label: "Brand", hint: "Stay within the approved brand profile" },
  hybrid: { label: "Hybrid", hint: "Brand palette and rules, exploratory form" },
};

export const DEFAULT_BRIEF: Brief = {
  prompt: "",
  mode: "explore",
  category: "tailoring",
  silhouette: "oversized",
  materials: ["wool"],
  palette: [],
  targetCollectionId: null,
  count: 4,
  creativity: MODE_DEFAULT_CREATIVITY.explore,
  seed: 1027,
  simulateFailure: false,
  brandStrictness: 0,
  variationOf: null,
  referenceIds: [],
};

export function buildGenerateRequest(
  brief: Brief,
  opts: { orgId: ID; brand: BrandProfileVersion | null; eligibleReferenceIds?: ID[]; idempotencyKey: string },
): GenerateRequestInput {
  // Only the approved version is ever passed in; drafts never condition generation.
  const brandContext = buildBrandContext(brief.mode, opts.brand, {
    strictness: brief.brandStrictness,
    referenceIds: opts.eligibleReferenceIds ?? [],
  });
  return {
    orgId: opts.orgId,
    prompt: brief.prompt,
    category: brief.category,
    silhouette: brief.silhouette,
    materials: brief.materials,
    palette: brief.palette,
    mode: brief.mode,
    brandProfileVersion: brandContext?.version ?? null,
    brandContext,
    targetCollectionId: brief.targetCollectionId,
    referenceAssetIds: brief.referenceIds,
    count: brief.count,
    creativity: brief.creativity,
    seed: brief.seed,
    variationOf: brief.variationOf,
    simulateFailure: brief.simulateFailure,
    idempotencyKey: opts.idempotencyKey,
  };
}

/** Pre-fill a brief from an existing concept for a variation. Source stays untouched. */
export function briefFromConcept(c: Concept, current: Brief): Brief {
  const materials = materialsFromFabrics(c.fabrics);
  return {
    ...current,
    prompt: c.prompt,
    mode: c.mode,
    brandStrictness: strictnessFor(c.mode),
    category: c.category,
    silhouette: c.silhouette,
    materials: materials.length ? materials.slice(0, 3) : current.materials,
    palette: c.palette.map((p) => p.hex).slice(0, 4),
    count: 2,
    seed: ((c.seed ?? current.seed) + 1) % 2 ** 31,
    simulateFailure: false,
    variationOf: c.id,
  };
}
