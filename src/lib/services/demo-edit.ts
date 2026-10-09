// Deterministic edit interpretation for the demo adapter. It recognises only
// controlled vocabulary (silhouettes, materials, named colours, construction
// details) in the instruction. Anything else is reported as unrecognised —
// no free-text understanding is claimed.
import { BRAND_PROFILE } from "@/lib/fixtures";
import { CONSTRUCTION_DETAILS, CLOSURE_DETAILS, FINISH_DETAILS, materialsFromFabrics } from "@/lib/brand/vocabulary";
import { MATERIALS, SILHOUETTES, type ConceptSnapshot, type Material, type PaletteColor, type Region, type VersionChange } from "@/lib/types/domain";
import { EXPLORE_PALETTES, createRng, hashString } from "./demo-engine";

const BASIC_COLOURS: PaletteColor[] = [
  { name: "Black", hex: "#141414" },
  { name: "White", hex: "#F6F4EF" },
  { name: "Cream", hex: "#EFE6D2" },
  { name: "Navy", hex: "#1F2A44" },
  { name: "Camel", hex: "#B08A5B" },
  { name: "Grey", hex: "#8E8C88" },
  { name: "Olive", hex: "#5E6243" },
  { name: "Burgundy", hex: "#6E1F2B" },
];

/** Colour names the editor understands, longest first so "dry sage" beats "sage". */
export const EDIT_COLOURS: PaletteColor[] = [
  ...BRAND_PROFILE.content.palette.map(({ name, hex }) => ({ name, hex })),
  ...EXPLORE_PALETTES.flat(),
  ...BASIC_COLOURS,
]
  .filter((c, i, all) => all.findIndex((d) => d.name.toLowerCase() === c.name.toLowerCase()) === i)
  .sort((a, b) => b.name.length - a.name.length);

const FABRIC_FOR: Record<Material, string> = {
  cotton: "cotton poplin",
  wool: "lightweight wool",
  linen: "washed linen",
  silk: "silk crepe",
  denim: "washed denim",
  technical: "matte technical twill",
};

const SILHOUETTE_WORDS: Record<string, (typeof SILHOUETTES)[number]> = {
  ...Object.fromEntries(SILHOUETTES.map((s) => [s, s])),
  "more structured": "structured",
  boxy: "oversized",
  slim: "fitted",
  loose: "relaxed",
  fluid: "draped",
};

const MATERIAL_WORDS: Record<string, Material> = {
  ...Object.fromEntries(MATERIALS.map((m) => [m, m])),
  poplin: "cotton",
  flannel: "wool",
  merino: "wool",
  satin: "silk",
  nylon: "technical",
};

const has = (text: string, term: string) => new RegExp(`(^|[^a-z])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "i").test(text);

/** Lower-third regions target the accent band in the schematic preview. */
export const targetsAccent = (region: Region | null) => Boolean(region && region.y + region.h / 2 > 0.66);

export interface ParsedEdit {
  changes: VersionChange[];
  /** Words that looked like edit targets but aren't supported (for honest feedback). */
  unsupported: string[];
}

const UNSUPPORTED_HINTS = ["sleeve", "collar", "pocket", "hem", "neckline", "lapel", "cuff", "print", "pattern", "embroider", "length"];

export function parseInstruction(instruction: string, base: ConceptSnapshot, region: Region | null = null): ParsedEdit {
  const text = instruction.toLowerCase();
  const changes: VersionChange[] = [];

  const silhouette = Object.entries(SILHOUETTE_WORDS).find(([w]) => has(text, w))?.[1];
  if (silhouette && silhouette !== base.silhouette) changes.push({ attribute: "silhouette", from: base.silhouette, to: silhouette });

  const material = Object.entries(MATERIAL_WORDS).find(([w]) => has(text, w))?.[1];
  const currentMaterials = materialsFromFabrics(base.fabrics);
  if (material && !currentMaterials.includes(material)) changes.push({ attribute: "material", from: base.fabrics.join(", ") || "—", to: FABRIC_FOR[material] });

  const colour = EDIT_COLOURS.find((c) => has(text, c.name.toLowerCase()));
  if (colour) {
    const accent = targetsAccent(region) || /\b(accent|trim|contrast|lower|hem band)\b/.test(text);
    const idx = accent ? 1 : 0;
    const current = base.palette[idx];
    if (!current || current.hex.toUpperCase() !== colour.hex.toUpperCase()) {
      changes.push({ attribute: accent ? "accent" : "colour", from: current?.name ?? "—", to: colour.name });
    }
  }

  // Phrase shortcuts map onto the controlled detail vocabulary.
  const SHORTCUTS: [RegExp, string][] = [
    [/\b(simplif\w*|minimal|clean(er)?|hide|conceal\w*)\b.*\b(fasten\w*|closure\w*|button\w*|hardware)\b|\bconcealed (fastening|closure)\b/, "clean facings, no visible hardware"],
    [/\b(fasten\w*|closure\w*)\b.*\b(simplif\w*|minimal|clean(er)?)\b/, "clean facings, no visible hardware"],
    [/\bhidden placket\b/, "concealed placket"],
  ];
  const detail =
    [...CONSTRUCTION_DETAILS].sort((a, b) => b.length - a.length).find((d) => text.includes(d.toLowerCase())) ??
    SHORTCUTS.find(([re]) => re.test(text))?.[1];
  if (detail && !(base.details ?? []).includes(detail)) {
    const isClosure = (CLOSURE_DETAILS as readonly string[]).includes(detail);
    const replaced = (base.details ?? []).find((d) => (isClosure ? (CLOSURE_DETAILS as readonly string[]) : (FINISH_DETAILS as readonly string[])).includes(d));
    changes.push({ attribute: "detail", from: replaced ?? "—", to: detail });
  }

  const unsupported = UNSUPPORTED_HINTS.filter((w) => text.includes(w));
  return { changes, unsupported };
}

export function applyEdit(base: ConceptSnapshot, changes: VersionChange[], instruction: string): ConceptSnapshot {
  const next: ConceptSnapshot = structuredClone(base);
  for (const c of changes) {
    if (c.attribute === "silhouette") next.silhouette = c.to as ConceptSnapshot["silhouette"];
    if (c.attribute === "material") next.fabrics = [c.to];
    if (c.attribute === "colour" || c.attribute === "accent") {
      const colour = EDIT_COLOURS.find((x) => x.name === c.to)!;
      const idx = c.attribute === "accent" ? 1 : 0;
      next.palette = [...next.palette];
      next.palette[idx] = { name: colour.name, hex: colour.hex };
      next.palette = next.palette.filter(Boolean);
    }
    if (c.attribute === "detail") {
      const details = (next.details ?? []).filter((d) => d !== c.from);
      next.details = [...details, c.to];
    }
  }
  // Seed shifts so the schematic's construction marks visibly differ per version.
  next.seed = createRng(hashString(instruction) ^ (base.seed ?? 0))() * 1e6 | 0;
  const summary = changes.map((c) => `${c.attribute} ${c.from} → ${c.to}`).join("; ");
  next.description = `${base.description.replace(/ Revised:.*$/, "")} Revised: ${summary}.`;
  if (changes.some((c) => c.attribute === "silhouette")) {
    next.title = `${base.title.replace(/ — .*$/, "")} — ${next.silhouette}`;
  }
  return next;
}
