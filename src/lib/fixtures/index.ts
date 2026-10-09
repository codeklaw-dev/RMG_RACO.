// Seed data for one fictional brand. No real brands, logos or people.
// All imagery is rendered as neutral placeholders (licenseStatus: "placeholder").
import type {
  Asset,
  Silhouette,
  Collection,
  Concept,
  GarmentCategory,
  GenerationJob,
  Organization,
  PaletteColor,
  User,
} from "@/lib/types/domain";
import { BRAND_REFERENCES, BRAND_VERSIONS } from "./brand";

export const ORG: Organization = { id: "org_serein", name: "Serein Atelier" };

export const CURRENT_USER: User = {
  id: "usr_amara",
  orgId: ORG.id,
  name: "Amara Okafor",
  role: "creative_director",
};

const C = {
  stone: { name: "Stone", hex: "#CFC6B8" },
  espresso: { name: "Espresso", hex: "#3B2A22" },
  bone: { name: "Bone", hex: "#EDE6DA" },
  ink: { name: "Ink", hex: "#1C1C1E" },
  oxblood: { name: "Oxblood", hex: "#8C2F37" },
  sage: { name: "Dry Sage", hex: "#A7A98F" },
  salt: { name: "Salt", hex: "#F4F1EA" },
  clay: { name: "Clay", hex: "#B57A5A" },
} satisfies Record<string, PaletteColor>;

export const ASSETS: Asset[] = [
  ["ast_ref_01", "reference", "AW24 archive — wrap coat"],
  ["ast_ref_02", "reference", "AW24 archive — column dress"],
  ["ast_ref_03", "moodboard", "Brutalist interiors, Lisbon"],
  ["ast_ref_04", "moodboard", "Undyed linen swatch study"],
  ["ast_ref_05", "sketch", "Shoulder construction sketch"],
  ["ast_ref_06", "reference", "SS25 archive — poplin shirt"],
].map(([id, kind, label]) => ({
  id,
  orgId: ORG.id,
  kind: kind as Asset["kind"],
  storageKey: `placeholder/${id}`,
  label,
  licenseStatus: "placeholder",
  consentStatus: "not_required",
  provenance: "Demo placeholder — to be replaced with client-owned archive imagery.",
}));

/** The approved Serein Atelier version shipped with the demo (v3). */
export const BRAND_PROFILE = BRAND_VERSIONS.find((v) => v.status === "approved")!;
export { BRAND_REFERENCES, BRAND_VERSIONS };

type Seed = [id: string, title: string, category: GarmentCategory, palette: PaletteColor[], fabric: string, mode: Concept["mode"], collectionId: string | null, fav?: boolean];

const SEED_SILHOUETTE: Record<GarmentCategory, Silhouette> = {
  outerwear: "structured", tailoring: "tailored", dress: "draped", shirt: "relaxed",
  trousers: "relaxed", skirt: "fitted", knitwear: "relaxed", jacket: "structured",
};

const SEEDS: Seed[] = [
  ["cpt_01", "Extended-shoulder wrap coat", "outerwear", [C.stone, C.espresso], "Double-faced wool", "brand", "col_aw26", true],
  ["cpt_02", "Column dress, bias seam", "dress", [C.ink], "Silk crepe", "brand", "col_aw26"],
  ["cpt_03", "Cocoon cape blazer", "tailoring", [C.espresso, C.bone], "Wool gabardine", "hybrid", "col_aw26", true],
  ["cpt_04", "Wide-leg pleated trouser", "trousers", [C.stone], "Wool flannel", "brand", "col_aw26"],
  ["cpt_05", "Funnel-neck rib knit", "knitwear", [C.oxblood], "Merino rib", "explore", "col_aw26"],
  ["cpt_06", "Asymmetric tailored skirt", "skirt", [C.ink, C.stone], "Wool crepe", "hybrid", "col_aw26"],
  ["cpt_07", "Balloon-sleeve poplin shirt", "shirt", [C.salt], "Cotton poplin", "brand", "col_resort", true],
  ["cpt_08", "Linen slip dress", "dress", [C.sage], "Washed linen", "brand", "col_resort"],
  ["cpt_09", "Unlined linen overshirt", "outerwear", [C.bone, C.clay], "Washed linen", "explore", "col_resort"],
  ["cpt_10", "Drawstring wide trouser", "trousers", [C.salt], "Linen twill", "brand", "col_resort"],
  ["cpt_11", "Wrap midi skirt", "skirt", [C.clay], "Cotton voile", "hybrid", "col_resort"],
  ["cpt_12", "Sculpted trench, dropped yoke", "outerwear", [C.stone, C.ink], "Cotton gabardine", "explore", null],
  ["cpt_13", "Soft double-breasted jacket", "tailoring", [C.bone], "Linen-silk", "brand", null],
  ["cpt_14", "Open-back column gown", "dress", [C.espresso], "Silk satin", "explore", null],
];

export const CONCEPTS: Concept[] = SEEDS.map(([id, title, category, palette, fabric, mode, collectionId, fav], i) => ({
  id,
  orgId: ORG.id,
  collectionId,
  brandProfileVersion: mode === "explore" ? null : BRAND_PROFILE.version,
  title,
  category,
  silhouette: SEED_SILHOUETTE[category],
  details: [i % 3 === 0 ? "clean facings, no visible hardware" : "concealed placket", i % 2 ? "hand-felled hems" : "bound seams"],
  description: `${title} in ${fabric.toLowerCase()}. Archive concept from the ${collectionId === "col_resort" ? "Resort27" : "AW26"} development cycle.`,
  prompt: `${title}. ${fabric}, ${palette.map((p) => p.name.toLowerCase()).join(" and ")} palette, studio editorial lighting, no logos.`,
  mode,
  status: i % 5 === 0 ? "approved" : i % 3 === 0 ? "in_review" : "draft",
  palette,
  fabrics: [fabric],
  favorite: Boolean(fav),
  capability: "simulated",
  currentVersionId: `${id}_v1`,
  parentConceptId: null,
  jobId: null,
  seed: null,
  provenance: "Seed fixture · schematic placeholder · no model involved",
  createdAt: new Date(Date.UTC(2026, 9, 8 - (i % 7), 9 + i)).toISOString(),
}));

export const COLLECTIONS: Collection[] = [
  {
    id: "col_aw26",
    orgId: ORG.id,
    name: "Quiet Architecture",
    season: "AW26",
    status: "in_review",
    description: "Tailored outerwear and columns in stone, espresso and ink.",
    creativeDirection: "Architecture softened: extended shoulders over fluid columns, worn tonal.",
    notes: "",
    groups: [{ id: "grp_outer", name: "Outerwear & tailoring" }, { id: "grp_soft", name: "Soft columns" }],
    conceptIds: CONCEPTS.filter((c) => c.collectionId === "col_aw26").map((c) => c.id),
    updatedAt: "2026-10-08T16:40:00Z",
  },
  {
    id: "col_resort",
    orgId: ORG.id,
    name: "Salt & Linen",
    season: "Resort27",
    status: "concept",
    description: "Unlined resortwear in washed linen and poplin.",
    creativeDirection: "Salt-washed ease: relaxed volumes, natural fibres, nothing lined.",
    notes: "",
    groups: [],
    conceptIds: CONCEPTS.filter((c) => c.collectionId === "col_resort").map((c) => c.id),
    updatedAt: "2026-10-07T11:05:00Z",
  },
];

export const JOBS: GenerationJob[] = [
  { id: "job_301", orgId: ORG.id, type: "generate", provider: "demo", status: "succeeded", progress: 1, stage: null, attempt: 1, label: "4 outerwear concepts · Brand v3", errorCode: null, costEstimate: null, resultConceptIds: ["cpt_01", "cpt_12"], createdAt: "2026-10-09T09:12:00Z" },
  { id: "job_302", orgId: ORG.id, type: "edit", provider: "demo", status: "running", progress: 0.62, stage: null, attempt: 1, label: "Balloon sleeve refinement", errorCode: null, costEstimate: null, resultConceptIds: [], createdAt: "2026-10-09T09:40:00Z" },
  { id: "job_303", orgId: ORG.id, type: "analyze_brand", provider: "demo", status: "queued", progress: 0, stage: null, attempt: 1, label: "Analyse 6 new references", errorCode: null, costEstimate: null, resultConceptIds: [], createdAt: "2026-10-09T09:41:00Z" },
  { id: "job_299", orgId: ORG.id, type: "generate", provider: "demo", status: "failed", progress: 0.3, stage: null, attempt: 1, label: "Knitwear exploration", errorCode: "provider_unavailable", costEstimate: null, resultConceptIds: [], createdAt: "2026-10-08T17:02:00Z" },
];
