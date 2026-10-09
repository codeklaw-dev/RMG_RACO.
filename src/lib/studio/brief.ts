// Brief = what the designer edits. buildGenerateRequest turns it into the
// provider request. Phase 3 enriches buildBrandContext(); call sites stay put.
import type { BrandContext, GenerateRequestInput } from "@/lib/services/ai-provider";
import type { BrandProfile, Concept, DesignMode, GarmentCategory, ID, Material, Silhouette } from "@/lib/types/domain";

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
  variationOf: ID | null;
  referenceIds: ID[];
}

export const MODE_DEFAULT_CREATIVITY: Record<DesignMode, number> = { explore: 0.7, brand: 0.25, hybrid: 0.5 };
export const MODE_EXPLORATION_WEIGHT: Record<DesignMode, number> = { explore: 1, brand: 0.2, hybrid: 0.5 };

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
  variationOf: null,
  referenceIds: [],
};

export function buildBrandContext(mode: DesignMode, brand: BrandProfile | null): BrandContext | null {
  if (mode === "explore" || !brand) return null;
  return {
    profileId: brand.id,
    version: brand.version,
    approved: brand.approved,
    palette: brand.palette.map((p) => p.hex),
    styleRuleIds: brand.styleRules.map((r) => r.id),
    negativeRuleIds: brand.negativeRules.map((r) => r.id),
    explorationWeight: MODE_EXPLORATION_WEIGHT[mode],
  };
}

export function buildGenerateRequest(
  brief: Brief,
  opts: { orgId: ID; brand: BrandProfile | null; idempotencyKey: string },
): GenerateRequestInput {
  const brandContext = buildBrandContext(brief.mode, opts.brand);
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

const MATERIAL_WORDS: [Material, RegExp][] = [
  ["cotton", /cotton|poplin|gabardine|twill|voile/i],
  ["wool", /wool|flannel|merino|crepe/i],
  ["linen", /linen/i],
  ["silk", /silk|satin/i],
  ["denim", /denim/i],
  ["technical", /technical|nylon|shell/i],
];

/** Pre-fill a brief from an existing concept for a variation. Source stays untouched. */
export function briefFromConcept(c: Concept, current: Brief): Brief {
  const materials = MATERIAL_WORDS.filter(([, re]) => c.fabrics.some((f) => re.test(f))).map(([m]) => m);
  return {
    ...current,
    prompt: c.prompt,
    mode: c.mode,
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
