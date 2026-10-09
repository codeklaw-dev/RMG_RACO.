// Serein Atelier — fictional demo brand. Version history v1–v3; v3 approved.
import type { BrandDNA, BrandProfileVersion, BrandReference, BrandRule, RuleEffect } from "@/lib/types/brand";

export const BRAND_ORG_ID = "org_serein";
export const BRAND_PROFILE_ID = "brd_serein";

const T0 = "2026-09-12T09:00:00Z";

const rule = (
  id: string, kind: BrandRule["kind"], title: string, description: string, category: BrandRule["category"],
  priority: BrandRule["priority"], effect: RuleEffect, enabled = true, refs: string[] = [],
): BrandRule => ({ id, kind, title, description, category, priority, enabled, approval: "approved", effect, sourceReferenceIds: refs, createdAt: T0, updatedAt: T0 });

const RULES_V3: BrandRule[] = [
  rule("r_shoulder", "positive", "Architectural tailoring", "Structured or tailored lines; shoulders read precise and slightly extended.", "silhouette", "high", { type: "prefer_silhouette", values: ["structured", "tailored"] }, true, ["ref_01", "ref_05"]),
  rule("r_natural", "positive", "Natural fibres first", "Wool, linen, cotton and silk lead every capsule.", "material", "medium", { type: "prefer_material", values: ["wool", "linen", "cotton", "silk"] }, true, ["ref_04"]),
  rule("r_closure", "positive", "Clean construction", "Concealed closures and clean facings; construction is felt, not seen.", "construction", "high", { type: "prefer_detail", values: ["concealed placket", "clean facings, no visible hardware"] }, true, ["ref_01"]),
  rule("r_luxury", "positive", "Understated luxury", "Quality is communicated through cut and fabric, never ornament.", "general", "low", { type: "guidance" }),
  rule("n_palette", "negative", "Restrained colour only", "Stay within the approved palette. No fluorescent or high-saturation colour.", "colour", "high", { type: "palette_only" }, true, ["ref_03"]),
  rule("n_logos", "negative", "No visible branding", "No logos, monograms or oversized branding.", "branding", "high", { type: "guidance" }),
  rule("n_hardware", "negative", "No decorative hardware", "Avoid exposed metal hardware and decorative snaps.", "construction", "medium", { type: "avoid_detail", values: ["exposed metal hardware", "asymmetric snap closure"] }),
  rule("n_synthetic", "negative", "No technical synthetics", "Technical shells and denim sit outside the brand.", "material", "medium", { type: "avoid_material", values: ["technical", "denim"] }),
  // Disabled in v3 — enabling it is the Phase 3 demo moment.
  rule("n_oversized", "negative", "Avoid oversized volume", "Volume comes from cut, not size. No oversized silhouettes.", "silhouette", "high", { type: "avoid_silhouette", values: ["oversized"] }, false),
];

const CONTENT_V3: BrandDNA = {
  name: "Serein Atelier",
  description: "Quiet, architectural womenswear. Precise shoulders, long uninterrupted lines and natural fibres in an earthen palette.",
  positioning: "Considered luxury for women who buy fewer, better pieces. Novelty lives in construction, not ornament.",
  identity: {
    personality: "Composed, exacting, warm rather than cold.",
    creativeDirection: "Architecture-led tailoring softened by fluid drape; every season refines a small set of silhouettes.",
    targetAudience: "Women 30–55, design-literate professionals.",
    keywords: ["architectural", "restrained", "tactile", "precise"],
    categories: ["tailoring", "outerwear", "dress", "trousers"],
    silhouettes: ["structured", "tailored", "draped"],
    signatureElements: ["Extended shoulder", "Concealed placket", "Mid-calf hem"],
    seasonalInfluences: ["Brutalist interiors", "Undyed textiles"],
  },
  palette: [
    { id: "c_stone", name: "Stone", hex: "#CFC6B8", role: "primary", signature: true },
    { id: "c_espresso", name: "Espresso", hex: "#3B2A22", role: "primary", signature: false },
    { id: "c_ink", name: "Ink", hex: "#1C1C1E", role: "primary", signature: false },
    { id: "c_bone", name: "Bone", hex: "#EDE6DA", role: "secondary", signature: false },
    { id: "c_oxblood", name: "Oxblood", hex: "#8C2F37", role: "secondary", signature: true },
    { id: "c_sage", name: "Dry Sage", hex: "#A7A98F", role: "secondary", signature: false },
  ],
  materials: {
    preferred: ["wool", "linen", "cotton", "silk"],
    restricted: ["technical", "denim"],
    constructionDetails: ["concealed placket", "clean facings, no visible hardware", "hand-felled hems"],
    notes: "Double-faced wool for outerwear; washed linen and poplin for resort.",
    sustainability: "Prefer traceable mills and undyed or low-impact dyed cloth.",
    seasonal: { autumnWinter: ["wool", "silk"], springSummer: ["linen", "cotton"] },
  },
  rules: RULES_V3,
};

const v = (version: number, status: BrandProfileVersion["status"], content: BrandDNA, at: string, note: string): BrandProfileVersion => ({
  id: `${BRAND_PROFILE_ID}_v${version}`,
  orgId: BRAND_ORG_ID,
  profileId: BRAND_PROFILE_ID,
  version,
  status,
  content,
  basedOnVersion: version > 1 ? version - 1 : null,
  note,
  createdAt: at,
  updatedAt: at,
  submittedAt: at,
  approvedAt: at,
  approvedBy: "Amara Okafor (simulated approval)",
});

export const BRAND_VERSIONS: BrandProfileVersion[] = [
  v(1, "archived", { ...CONTENT_V3, palette: CONTENT_V3.palette.slice(0, 4), rules: RULES_V3.slice(0, 3) }, "2026-06-02T10:00:00Z", "Initial profile from AW24 archive"),
  v(2, "archived", { ...CONTENT_V3, rules: RULES_V3.filter((r) => r.id !== "n_synthetic" && r.id !== "n_oversized") }, "2026-08-14T10:00:00Z", "Added palette and construction rules"),
  v(3, "approved", CONTENT_V3, "2026-10-06T10:12:00Z", "Material exclusions for AW26"),
];

/** Fixture references are demo placeholders: always available, no image file. */
export const BRAND_REFERENCES: BrandReference[] = (
  [
    ["ref_01", "AW24 wrap coat", "archive", ["outerwear", "shoulder"]],
    ["ref_02", "AW24 column dress", "archive", ["dress", "line"]],
    ["ref_03", "Brutalist interiors, Lisbon", "moodboard", ["colour", "mood"]],
    ["ref_04", "Undyed linen swatch study", "fabric", ["linen", "colour"]],
    ["ref_05", "Shoulder construction sketch", "sketch", ["shoulder", "tailoring"]],
    ["ref_06", "SS25 poplin shirt", "archive", ["shirt", "placket"]],
  ] as const
).map(([id, title, category, tags], i) => ({
  id,
  orgId: BRAND_ORG_ID,
  title,
  description: "",
  category,
  tags: [...tags],
  source: "Serein Atelier archive (demo placeholder)",
  rightsConfirmed: true,
  approval: i < 5 ? "approved" : "pending",
  fileName: null,
  fileSize: null,
  fileType: null,
  createdAt: T0,
}));
