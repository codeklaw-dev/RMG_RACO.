// Deterministic concept synthesis for the demo adapter.
// Same request + seed → same concepts (ids aside). Nothing here is AI inference:
// it combines the submitted attributes with curated vocabulary via a seeded PRNG.
import type { Concept, GarmentCategory, Material, PaletteColor, Silhouette } from "@/lib/types/domain";
import { SILHOUETTES } from "@/lib/types/domain";
import { CLOSURE_DETAILS, FINISH_DETAILS } from "@/lib/brand/vocabulary";
import type { GenerateRequest } from "./ai-provider";

/** mulberry32 — small, fast, deterministic. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const pick = <T,>(rng: () => number, xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];

const NOUN: Record<GarmentCategory, string[]> = {
  tailoring: ["blazer", "single-breasted jacket", "tuxedo jacket", "waistcoat"],
  dress: ["column dress", "slip dress", "shirt dress", "wrap dress"],
  shirt: ["shirt", "tunic shirt", "camp-collar shirt", "bib-front shirt"],
  trousers: ["trouser", "wide-leg trouser", "barrel-leg trouser", "cigarette trouser"],
  jacket: ["field jacket", "chore jacket", "bomber", "cropped jacket"],
  skirt: ["midi skirt", "pencil skirt", "sarong skirt", "pleated skirt"],
  knitwear: ["rib sweater", "cardigan", "funnel-neck knit", "knitted vest"],
  outerwear: ["overcoat", "trench", "cocoon coat", "car coat"],
};

const DETAIL: Record<GarmentCategory, string[]> = {
  tailoring: ["Architectural-shoulder", "Collarless", "Soft-construction", "Cut-away"],
  dress: ["Bias-cut", "Asymmetric-hem", "Open-back", "Seam-sculpted"],
  shirt: ["Balloon-sleeve", "Concealed-placket", "Dropped-shoulder", "Pleat-back"],
  trousers: ["Double-pleat", "Seam-front", "Drawstring", "High-rise"],
  jacket: ["Utility-pocket", "Funnel-collar", "Boxy", "Raglan"],
  skirt: ["Wrap-front", "Panelled", "Knife-pleat", "Split-hem"],
  knitwear: ["Ribbed", "Fully-fashioned", "Ottoman-stitch", "Cable-panel"],
  outerwear: ["Extended-shoulder", "Dropped-yoke", "Storm-flap", "Blanket"],
};


const FABRIC: Record<Material, string[]> = {
  cotton: ["cotton poplin", "cotton gabardine", "brushed cotton twill"],
  wool: ["lightweight wool", "double-faced wool", "wool crepe"],
  linen: ["washed linen", "linen twill", "linen-silk"],
  silk: ["silk crepe", "silk satin", "silk faille"],
  denim: ["rigid selvedge denim", "washed denim", "black denim"],
  technical: ["bonded technical shell", "recycled nylon taffeta", "matte technical twill"],
};

const SILHOUETTE_NOTE: Record<Silhouette, string> = {
  tailored: "a precise tailored line",
  oversized: "generous oversized proportions",
  relaxed: "an easy, relaxed fall",
  structured: "a structured, architectural frame",
  fitted: "a close, fitted line",
  draped: "fluid draping from the shoulder",
};

/** Curated exploratory palettes used when Explore has no palette chosen. */
export const EXPLORE_PALETTES: PaletteColor[][] = [
  [{ name: "Charcoal", hex: "#3E3E40" }, { name: "Chalk", hex: "#ECE9E2" }],
  [{ name: "Moss", hex: "#5F6B4E" }, { name: "Bone", hex: "#EDE6DA" }],
  [{ name: "Ink Navy", hex: "#22293A" }, { name: "Stone", hex: "#CFC6B8" }],
  [{ name: "Rust", hex: "#9C4A2F" }, { name: "Sand", hex: "#D9C7A7" }],
  [{ name: "Slate Blue", hex: "#5B6B7F" }, { name: "Ecru", hex: "#E8E0CF" }],
  [{ name: "Oxblood", hex: "#8C2F37" }, { name: "Ink", hex: "#1C1C1E" }],
];

const KNOWN_COLOURS: Record<string, string> = Object.fromEntries(
  [...EXPLORE_PALETTES.flat(), { name: "Espresso", hex: "#3B2A22" }, { name: "Dry Sage", hex: "#A7A98F" }, { name: "Salt", hex: "#F4F1EA" }, { name: "Clay", hex: "#B57A5A" }].map((c) => [c.hex.toUpperCase(), c.name]),
);
const toColour = (hex: string): PaletteColor => ({ hex, name: KNOWN_COLOURS[hex.toUpperCase()] ?? hex.toUpperCase() });

/** Up to two distinct colours from a pool; never returns undefined entries. */
function pickTwo(rng: () => number, pool: PaletteColor[]): PaletteColor[] {
  const unique = pool.filter((c, i) => pool.findIndex((d) => d.hex === c.hex) === i);
  if (!unique.length) return [];
  const a = pick(rng, unique);
  const rest = unique.filter((c) => c.hex !== a.hex);
  return rest.length ? [a, pick(rng, rest)] : [a];
}

/**
 * Palette fallback order:
 *  Brand  — chosen ∩ brand → brand palette → curated explore palette
 *  Hybrid — one brand colour + one chosen/explore colour (distinct); brand empty → explore only
 *  Explore — chosen → curated explore palette
 */
export function choosePalette(req: GenerateRequest, rng: () => number): PaletteColor[] {
  const avoid = new Set(req.brandContext?.avoidColours ?? []);
  const allowed = (c: PaletteColor) => !avoid.has(c.hex.toUpperCase());
  const chosen = req.palette.map(toColour).filter(allowed);
  const brand = (req.brandContext?.palette ?? []).map(toColour).filter(allowed);
  const signature = (req.brandContext?.signaturePalette ?? []).map(toColour).filter(allowed);
  const fallback = () => {
    const ok = EXPLORE_PALETTES.filter((p) => p.every(allowed));
    return pick(rng, ok.length ? ok : EXPLORE_PALETTES);
  };
  if (req.mode === "brand") {
    const inBrand = chosen.filter((c) => brand.some((b) => b.hex === c.hex));
    const result = pickTwo(rng, inBrand.length ? inBrand : brand);
    return result.length ? result : fallback();
  }
  if (req.mode === "hybrid") {
    const explore = chosen.length ? chosen : fallback();
    const anchors = signature.length ? signature : brand;
    const anchor = anchors.length ? pick(rng, anchors) : null;
    const accentPool = explore.filter((c) => c.hex !== anchor?.hex);
    const accent = accentPool.length ? pick(rng, accentPool) : null;
    const result = [anchor, accent].filter((c): c is PaletteColor => c !== null);
    return result.length ? result : fallback();
  }
  const result = pickTwo(rng, chosen);
  return result.length ? result : fallback();
}

function chooseSilhouette(req: GenerateRequest, index: number, rng: () => number): Silhouette {
  const bc = req.brandContext;
  const strict = bc?.strictness ?? 0;
  const avoid = new Set(bc?.avoidSilhouettes ?? []);
  const allowed = SILHOUETTES.filter((s) => !avoid.has(s));
  const preferred = (bc?.preferredSilhouettes ?? []).filter((s) => !avoid.has(s));
  let s: Silhouette = req.silhouette;
  if (index > 0 && req.mode !== "brand") {
    // Explore drifts with creativity; Hybrid drifts at half the rate.
    const drift = req.mode === "explore" ? req.creativity : req.creativity / 2;
    if (rng() < drift) s = pick(rng, SILHOUETTES);
  }
  // Excluded silhouettes are replaced with probability = strictness (always in Brand at 0.9+ for most seeds).
  if (avoid.has(s) && rng() < Math.max(strict, req.mode === "brand" ? 1 : 0)) s = preferred.length ? pick(rng, preferred) : pick(rng, allowed);
  else if (bc && preferred.length && !preferred.includes(s) && rng() < strict * 0.5) s = pick(rng, preferred);
  return s;
}

function chooseMaterial(req: GenerateRequest, rng: () => number): Material {
  const bc = req.brandContext;
  if (!bc) return pick(rng, req.materials);
  const avoid = new Set(bc.avoidMaterials);
  const strictPass = rng() < bc.strictness;
  const requested = strictPass ? req.materials.filter((m) => !avoid.has(m)) : req.materials;
  const preferredRequested = requested.filter((m) => bc.preferredMaterials.includes(m));
  if (preferredRequested.length && strictPass) return pick(rng, preferredRequested);
  if (requested.length) return pick(rng, requested);
  const preferred = bc.preferredMaterials.filter((m) => !avoid.has(m));
  return preferred.length ? pick(rng, preferred) : pick(rng, req.materials);
}

function chooseDetails(req: GenerateRequest, rng: () => number): [string, string] {
  const bc = req.brandContext;
  const strictPass = bc ? rng() < bc.strictness : false;
  const avoid = new Set(strictPass ? bc!.avoidDetails : []);
  const choose = (pool: readonly string[]) => {
    const ok = pool.filter((d) => !avoid.has(d));
    const pref = strictPass ? ok.filter((d) => bc!.preferredDetails.includes(d)) : [];
    return pick(rng, pref.length ? pref : ok.length ? ok : pool);
  };
  return [choose(CLOSURE_DETAILS), choose(FINISH_DETAILS)];
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface SynthesisContext {
  jobId: string;
  now: string;
}

export function synthesizeConcepts(req: GenerateRequest, ctx: SynthesisContext): Concept[] {
  const base = hashString(
    JSON.stringify([req.prompt, req.category, req.silhouette, req.materials, req.palette, req.mode, req.creativity, req.variationOf]),
  );
  return Array.from({ length: req.count }, (_, i) => {
    const seed = (base ^ Math.imul(req.seed + i + 1, 2654435761)) >>> 0;
    // Independent stream per attribute: a brand rule that changes one attribute
    // leaves the others untouched, so before/after comparisons stay readable.
    const stream = (k: string) => createRng((seed ^ hashString(k)) >>> 0);
    const silhouette = chooseSilhouette(req, i, stream("silhouette"));
    const material = chooseMaterial(req, stream("material"));
    const fabricRng = stream("fabric");
    const fabric = pick(fabricRng, FABRIC[material]);
    const nameRng = stream("name");
    const noun = pick(nameRng, NOUN[req.category]);
    const detail = pick(nameRng, DETAIL[req.category]);
    const palette = choosePalette(req, stream("palette"));
    const [closure, finish] = chooseDetails(req, stream("details"));
    const title = `${detail} ${silhouette === req.silhouette ? "" : silhouette + " "}${noun}`.replace(/\s+/g, " ");
    const brandNote = req.brandContext
      ? ` Conditioned on approved Brand DNA v${req.brandContext.version} at strictness ${req.brandContext.strictness.toFixed(2)}.`
      : "";
    const description =
      `${cap(noun)} in ${fabric} with ${SILHOUETTE_NOTE[silhouette]}. ` +
      `${cap(closure)}, ${finish}. Palette: ${palette.map((p) => p.name.toLowerCase()).join(" and ")}.` +
      brandNote;

    return {
      id: `${ctx.jobId}_c${i + 1}`,
      orgId: req.orgId,
      collectionId: null,
      brandProfileVersion: req.brandContext?.version ?? null,
      title,
      category: req.category,
      silhouette,
      description,
      prompt: req.prompt,
      mode: req.mode,
      status: "draft",
      palette,
      fabrics: [fabric],
      details: [closure, finish],
      favorite: false,
      capability: "simulated",
      currentVersionId: `${ctx.jobId}_c${i + 1}_v1`,
      parentConceptId: req.variationOf,
      jobId: ctx.jobId,
      seed,
      provenance: `Simulated by demo adapter · request seed ${req.seed} · variant ${i + 1}/${req.count} · schematic placeholder, no model inference`,
      createdAt: ctx.now,
    } satisfies Concept;
  });
}
