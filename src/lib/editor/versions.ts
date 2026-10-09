// Pure helpers for immutable concept versions. A revision appends a version to
// the same concept; it never edits an existing one. Restoring copies an older
// snapshot into a NEW version whose parent is the current head.
import type { Concept, ConceptSnapshot, ConceptVersion, VersionChange, VersionOperation } from "@/lib/types/domain";

export const snapshotOf = (c: Concept): ConceptSnapshot => ({
  title: c.title, silhouette: c.silhouette, palette: c.palette, fabrics: c.fabrics, details: c.details,
  description: c.description, seed: c.seed, tags: c.tags ?? [], notes: c.notes ?? "",
});

export const versionsOf = (all: ConceptVersion[], conceptId: string) =>
  all.filter((v) => v.conceptId === conceptId).sort((a, b) => a.number - b.number);

export const originalVersion = (c: Concept): ConceptVersion => ({
  id: `${c.id}_v1`,
  conceptId: c.id,
  parentId: null,
  number: 1,
  summary: "Original",
  brandProfileVersion: c.brandProfileVersion,
  provenance: c.provenance,
  imageAssetId: `placeholder/${c.id}_v1`,
  operation: "generate",
  instruction: c.prompt,
  region: null,
  changes: [],
  snapshot: snapshotOf(c),
  capability: c.capability,
  jobId: c.jobId,
  createdAt: c.createdAt,
});

/** Field-level differences that a designer would recognise. */
export function diffSnapshots(a: ConceptSnapshot, b: ConceptSnapshot): VersionChange[] {
  const out: VersionChange[] = [];
  const push = (attribute: VersionChange["attribute"], from: string, to: string) => from !== to && out.push({ attribute, from: from || "—", to: to || "—" });
  push("silhouette", a.silhouette, b.silhouette);
  push("material", a.fabrics.join(", "), b.fabrics.join(", "));
  push("colour", a.palette[0]?.name ?? "", b.palette[0]?.name ?? "");
  push("accent", a.palette.slice(1).map((p) => p.name).join(", "), b.palette.slice(1).map((p) => p.name).join(", "));
  push("detail", (a.details ?? []).join(", "), (b.details ?? []).join(", "));
  push("title", a.title, b.title);
  push("description", a.description, b.description);
  push("tags", (a.tags ?? []).join(", "), (b.tags ?? []).join(", "));
  push("notes", a.notes ?? "", b.notes ?? "");
  return out;
}

export const summarize = (changes: VersionChange[]) =>
  changes.length ? changes.slice(0, 3).map((c) => `${c.attribute}: ${c.to}`).join(" · ") + (changes.length > 3 ? ` +${changes.length - 3}` : "") : "No changes";

/** Attributes the schematic renderer actually draws. Others are metadata only. */
export const RENDERED_ATTRIBUTES: VersionChange["attribute"][] = ["silhouette", "colour", "accent", "detail"];

export function nextVersion(
  all: ConceptVersion[],
  concept: Concept,
  input: { operation: VersionOperation; snapshot: ConceptSnapshot; instruction: string; changes?: VersionChange[]; region?: ConceptVersion["region"]; jobId?: string | null; id?: string; summary?: string },
): ConceptVersion {
  const own = versionsOf(all, concept.id);
  const head = own.find((v) => v.id === concept.currentVersionId) ?? own[own.length - 1];
  const number = (own[own.length - 1]?.number ?? 0) + 1;
  const changes = input.changes ?? (head ? diffSnapshots(head.snapshot, input.snapshot) : []);
  return {
    id: input.id ?? `${concept.id}_v${number}`,
    conceptId: concept.id,
    parentId: head?.id ?? null,
    number,
    summary: input.summary ?? summarize(changes),
    brandProfileVersion: concept.brandProfileVersion,
    provenance:
      input.operation === "manual" ? "Designer edit · metadata snapshot · schematic placeholder"
      : input.operation === "edit" ? "Simulated refinement by demo adapter · no model inference"
      : input.operation === "restore" ? `Restored copy · ${head?.provenance ?? ""}`
      : "Reopened as draft",
    imageAssetId: `placeholder/${concept.id}_v${number}`,
    operation: input.operation,
    instruction: input.instruction,
    region: input.region ?? null,
    changes,
    snapshot: input.snapshot,
    capability: "simulated",
    jobId: input.jobId ?? null,
    createdAt: new Date().toISOString(),
  };
}
