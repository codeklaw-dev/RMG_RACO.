// Deterministic brand intelligence: completeness, conflict detection, request
// context and consistency checks. Structured rule effects only — no semantic
// understanding of free-text rules is claimed.
import type { BrandContext } from "@/lib/services/ai-provider";
import type { Concept, DesignMode, ID } from "@/lib/types/domain";
import type { BrandDNA, BrandProfileVersion, BrandReference, BrandRule, RulePriority } from "@/lib/types/brand";
import { materialsFromFabrics } from "./vocabulary";

const HEX = /^#[0-9A-F]{6}$/i;
export const isHex = (s: string) => HEX.test(s);
export const normalizeHex = (s: string) => (s.startsWith("#") ? s : `#${s}`).toUpperCase();

/** Rules that actually take effect: enabled and approved. */
export const activeRules = (c: BrandDNA) => c.rules.filter((r) => r.enabled && r.approval === "approved");

// ── Completeness ─────────────────────────────────────────────
export interface CompletenessCheck { label: string; done: boolean }

export function completeness(c: BrandDNA, references: BrandReference[]) {
  const rules = activeRules(c);
  const checks: CompletenessCheck[] = [
    { label: "Description (40+ characters)", done: c.description.trim().length >= 40 },
    { label: "Positioning", done: c.positioning.trim().length > 0 },
    { label: "Personality", done: c.identity.personality.trim().length > 0 },
    { label: "Creative direction", done: c.identity.creativeDirection.trim().length > 0 },
    { label: "Target audience", done: c.identity.targetAudience.trim().length > 0 },
    { label: "3+ aesthetic keywords", done: c.identity.keywords.length >= 3 },
    { label: "Preferred garment categories", done: c.identity.categories.length > 0 },
    { label: "Preferred silhouettes", done: c.identity.silhouettes.length > 0 },
    { label: "Signature design elements", done: c.identity.signatureElements.length > 0 },
    { label: "3+ palette colours incl. a primary", done: c.palette.length >= 3 && c.palette.some((p) => p.role === "primary") },
    { label: "A signature colour", done: c.palette.some((p) => p.signature) },
    { label: "Preferred materials", done: c.materials.preferred.length > 0 },
    { label: "Construction details", done: c.materials.constructionDetails.length > 0 },
    { label: "2+ active positive rules", done: rules.filter((r) => r.kind === "positive").length >= 2 },
    { label: "1+ active negative rule", done: rules.some((r) => r.kind === "negative") },
    { label: "3+ approved references", done: references.filter((r) => r.approval === "approved").length >= 3 },
  ];
  const done = checks.filter((x) => x.done).length;
  return { score: Math.round((done / checks.length) * 100), checks };
}

// ── Conflict detection ───────────────────────────────────────
export interface RuleConflict { ids: ID[]; message: string }

const overlap = <T,>(a: readonly T[], b: readonly T[]) => a.filter((x) => b.includes(x));

/** Straightforward contradictions only: the same term both preferred and avoided. */
export function detectConflicts(c: BrandDNA): RuleConflict[] {
  const out: RuleConflict[] = [];
  const rules = c.rules.filter((r) => r.enabled);
  const pairs: [string, string, string][] = [
    ["prefer_silhouette", "avoid_silhouette", "silhouette"],
    ["prefer_material", "avoid_material", "material"],
    ["prefer_detail", "avoid_detail", "detail"],
  ];
  for (const [pos, neg, noun] of pairs) {
    for (const a of rules) for (const b of rules) {
      if (a.effect.type !== pos || b.effect.type !== neg) continue;
      const both = overlap((a.effect as { values: string[] }).values, (b.effect as { values: string[] }).values);
      if (both.length) out.push({ ids: [a.id, b.id], message: `“${a.title}” prefers and “${b.title}” avoids the ${noun} ${both.join(", ")}` });
    }
  }
  const restrictedPreferred = overlap(c.materials.preferred, c.materials.restricted);
  if (restrictedPreferred.length) out.push({ ids: [], message: `Materials both preferred and restricted: ${restrictedPreferred.join(", ")}` });
  for (const r of rules) {
    if (r.effect.type === "avoid_material") {
      const hit = overlap(r.effect.values, c.materials.preferred);
      if (hit.length) out.push({ ids: [r.id], message: `“${r.title}” avoids preferred material ${hit.join(", ")}` });
    }
    if (r.effect.type === "avoid_silhouette") {
      const hit = overlap(r.effect.values, c.identity.silhouettes);
      if (hit.length) out.push({ ids: [r.id], message: `“${r.title}” avoids preferred silhouette ${hit.join(", ")}` });
    }
    if (r.effect.type === "avoid_colour") {
      const hit = c.palette.filter((p) => r.effect.type === "avoid_colour" && r.effect.values.includes(p.hex.toUpperCase()));
      if (hit.length) out.push({ ids: [r.id], message: `“${r.title}” avoids palette colour ${hit.map((h) => h.name).join(", ")}` });
    }
  }
  return out;
}

// ── Request context ──────────────────────────────────────────
export const DEFAULT_STRICTNESS: Record<Exclude<DesignMode, "explore">, number> = { brand: 0.9, hybrid: 0.55 };

const collect = <K extends BrandRule["effect"]["type"]>(rules: BrandRule[], type: K) =>
  [...new Set(rules.flatMap((r) => (r.effect.type === type && "values" in r.effect ? (r.effect.values as string[]) : [])))];

/** A reference may inform a request only when approved and its image (or demo placeholder) is available. */
export const isReferenceEligible = (r: BrandReference, available: (id: ID) => boolean) => r.approval === "approved" && available(r.id);

/**
 * The single place approved Brand DNA becomes generation metadata.
 * Returns null for Explore, or when no approved version exists — unapproved
 * rules are never used.
 */
export function buildBrandContext(
  mode: DesignMode,
  approved: BrandProfileVersion | null,
  opts: { strictness?: number; referenceIds?: ID[] } = {},
): BrandContext | null {
  if (mode === "explore" || !approved || approved.status !== "approved") return null;
  const c = approved.content;
  const rules = activeRules(c);
  const strictness = opts.strictness ?? DEFAULT_STRICTNESS[mode];
  return {
    profileId: approved.profileId,
    version: approved.version,
    approved: true,
    palette: c.palette.map((p) => p.hex.toUpperCase()),
    signaturePalette: c.palette.filter((p) => p.signature).map((p) => p.hex.toUpperCase()),
    paletteOnly: rules.some((r) => r.effect.type === "palette_only"),
    avoidColours: collect(rules, "avoid_colour").map((h) => h.toUpperCase()),
    preferredSilhouettes: collect(rules, "prefer_silhouette") as BrandContext["preferredSilhouettes"],
    avoidSilhouettes: collect(rules, "avoid_silhouette") as BrandContext["avoidSilhouettes"],
    preferredMaterials: [...new Set([...collect(rules, "prefer_material"), ...c.materials.preferred])] as BrandContext["preferredMaterials"],
    avoidMaterials: [...new Set([...collect(rules, "avoid_material"), ...c.materials.restricted])] as BrandContext["avoidMaterials"],
    preferredDetails: [...new Set([...collect(rules, "prefer_detail"), ...c.materials.constructionDetails])],
    avoidDetails: collect(rules, "avoid_detail"),
    styleRuleIds: rules.filter((r) => r.kind === "positive").map((r) => r.id),
    negativeRuleIds: rules.filter((r) => r.kind === "negative").map((r) => r.id),
    guidance: rules.filter((r) => r.effect.type === "guidance").map((r) => r.title),
    referenceIds: opts.referenceIds ?? [],
    strictness,
    explorationWeight: Math.round((1 - strictness) * 100) / 100,
  };
}

// ── Consistency evaluation ───────────────────────────────────
export type CheckResult = "pass" | "fail" | "not_evaluated";
export interface RuleCheck { ruleId: ID; title: string; kind: BrandRule["kind"]; priority: RulePriority; result: CheckResult; reason: string }

const WEIGHT: Record<RulePriority, number> = { high: 3, medium: 2, low: 1 };

export function evaluateConcept(concept: Concept, profile: BrandDNA) {
  const materials = materialsFromFabrics(concept.fabrics);
  const details = concept.details ?? [];
  const paletteHexes = profile.palette.map((p) => p.hex.toUpperCase());
  const checks: RuleCheck[] = activeRules(profile).map((r) => {
    const base = { ruleId: r.id, title: r.title, kind: r.kind, priority: r.priority };
    const e = r.effect;
    const res = (ok: boolean, yes: string, no: string): RuleCheck => ({ ...base, result: ok ? "pass" : "fail", reason: ok ? yes : no });
    switch (e.type) {
      case "prefer_silhouette":
        return res(e.values.includes(concept.silhouette), `${concept.silhouette} is preferred`, `${concept.silhouette} is not among ${e.values.join(", ")}`);
      case "avoid_silhouette":
        return res(!e.values.includes(concept.silhouette), `${concept.silhouette} is allowed`, `${concept.silhouette} is excluded`);
      case "prefer_material": {
        const hit = overlap(materials, e.values);
        return res(hit.length > 0, `Uses ${hit.join(", ")}`, `No preferred material in ${concept.fabrics.join(", ") || "fabric list"}`);
      }
      case "avoid_material": {
        const hit = overlap(materials, e.values);
        return res(hit.length === 0, "No restricted material", `Uses restricted ${hit.join(", ")}`);
      }
      case "prefer_detail": {
        const hit = overlap(details, e.values);
        return details.length
          ? res(hit.length > 0, `Has ${hit.join(", ")}`, "None of the preferred construction details recorded")
          : { ...base, result: "not_evaluated", reason: "No construction details recorded for this concept" };
      }
      case "avoid_detail": {
        const hit = overlap(details, e.values);
        return details.length
          ? res(hit.length === 0, "No excluded details", `Has ${hit.join(", ")}`)
          : { ...base, result: "not_evaluated", reason: "No construction details recorded for this concept" };
      }
      case "avoid_colour": {
        const hit = concept.palette.filter((p) => e.values.includes(p.hex.toUpperCase()));
        return res(hit.length === 0, "No excluded colours", `Uses ${hit.map((h) => h.name).join(", ")}`);
      }
      case "palette_only": {
        const off = concept.palette.filter((p) => !paletteHexes.includes(p.hex.toUpperCase()));
        return res(off.length === 0, "All colours in the approved palette", `Off-palette: ${off.map((o) => o.name).join(", ")}`);
      }
      default:
        return { ...base, result: "not_evaluated", reason: "Guidance only — carried into the request, not scored" };
    }
  });
  const scored = checks.filter((c) => c.result !== "not_evaluated");
  const total = scored.reduce((s, c) => s + WEIGHT[c.priority], 0);
  const passed = scored.filter((c) => c.result === "pass").reduce((s, c) => s + WEIGHT[c.priority], 0);
  return { score: total ? Math.round((passed / total) * 100) : null, checks };
}

// ── Version diff ─────────────────────────────────────────────
export interface Change { section: string; label: string; from: string; to: string }

const list = (xs: readonly string[]) => (xs.length ? xs.join(", ") : "—");

export function diffContent(a: BrandDNA, b: BrandDNA): Change[] {
  const out: Change[] = [];
  const text = (section: string, label: string, x: string, y: string) => x !== y && out.push({ section, label, from: x || "—", to: y || "—" });
  const arr = (section: string, label: string, x: readonly string[], y: readonly string[]) => list(x) !== list(y) && out.push({ section, label, from: list(x), to: list(y) });
  text("Overview", "Name", a.name, b.name);
  text("Overview", "Description", a.description, b.description);
  text("Overview", "Positioning", a.positioning, b.positioning);
  const ia = a.identity, ib = b.identity;
  text("Identity", "Personality", ia.personality, ib.personality);
  text("Identity", "Creative direction", ia.creativeDirection, ib.creativeDirection);
  text("Identity", "Target audience", ia.targetAudience, ib.targetAudience);
  arr("Identity", "Keywords", ia.keywords, ib.keywords);
  arr("Identity", "Categories", ia.categories, ib.categories);
  arr("Identity", "Silhouettes", ia.silhouettes, ib.silhouettes);
  arr("Identity", "Signature elements", ia.signatureElements, ib.signatureElements);
  arr("Identity", "Seasonal influences", ia.seasonalInfluences, ib.seasonalInfluences);
  const pal = (p: BrandDNA["palette"]) => p.map((c) => `${c.name} ${c.hex}${c.signature ? "★" : ""} (${c.role})`);
  arr("Colour", "Palette", pal(a.palette), pal(b.palette));
  arr("Materials", "Preferred", a.materials.preferred, b.materials.preferred);
  arr("Materials", "Restricted", a.materials.restricted, b.materials.restricted);
  arr("Materials", "Construction details", a.materials.constructionDetails, b.materials.constructionDetails);
  text("Materials", "Notes", a.materials.notes, b.materials.notes);
  text("Materials", "Sustainability", a.materials.sustainability, b.materials.sustainability);
  const byId = new Map(a.rules.map((r) => [r.id, r]));
  for (const r of b.rules) {
    const prev = byId.get(r.id);
    const desc = (x: BrandRule) => `${x.enabled ? "on" : "off"} · ${x.priority} · ${x.title}`;
    if (!prev) out.push({ section: "Rules", label: `Added ${r.kind} rule`, from: "—", to: desc(r) });
    else if (desc(prev) !== desc(r) || prev.description !== r.description || JSON.stringify(prev.effect) !== JSON.stringify(r.effect))
      out.push({ section: "Rules", label: r.title, from: desc(prev), to: desc(r) });
    byId.delete(r.id);
  }
  for (const r of byId.values()) out.push({ section: "Rules", label: `Removed ${r.kind} rule`, from: r.title, to: "—" });
  const order = (rs: BrandRule[]) => rs.map((r) => r.id).filter((id) => a.rules.some((x) => x.id === id) && b.rules.some((x) => x.id === id));
  if (order(a.rules).join() !== order(b.rules).join()) out.push({ section: "Rules", label: "Order", from: "previous order", to: "reordered" });
  return out;
}
