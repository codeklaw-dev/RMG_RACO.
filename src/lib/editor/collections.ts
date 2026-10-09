// Pure collection helpers: palette summary, design-direction sections,
// collection review steps and presentation navigation.
import type { Collection, CollectionStatus, Concept, ID } from "@/lib/types/domain";

export function collectionPalette(looks: Concept[]) {
  const counts = new Map<string, { name: string; hex: string; count: number }>();
  for (const c of looks)
    for (const p of c.palette) {
      const key = p.hex.toUpperCase();
      const prev = counts.get(key);
      counts.set(key, { name: p.name, hex: p.hex, count: (prev?.count ?? 0) + 1 });
    }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

export function groupLooks(looks: Concept[], collection: Collection): { id: ID | null; name: string; looks: Concept[] }[] {
  const groups = collection.groups ?? [];
  const gid = (c: Concept) => {
    const g = collection.lookMeta?.[c.id]?.groupId;
    return g && groups.some((x) => x.id === g) ? g : null;
  };
  const sections: { id: ID | null; name: string; looks: Concept[] }[] = groups.map((g) => ({ id: g.id, name: g.name, looks: looks.filter((c) => gid(c) === g.id) }));
  const ungrouped = looks.filter((c) => gid(c) === null);
  if (ungrouped.length || !groups.length) sections.push({ id: null, name: "Ungrouped", looks: ungrouped });
  return sections;
}

/** Collection approval is its own simulated workflow (not concept or Brand DNA approval). */
export function nextCollectionStatus(status: CollectionStatus): { to: CollectionStatus; label: string } | null {
  if (status === "concept") return { to: "in_review", label: "Submit collection for review" };
  if (status === "in_review") return { to: "approved", label: "Approve collection (simulated)" };
  return null;
}

/** Slides: 0 = introduction, 1..n = looks, n+1 = closing. */
export function presentationStep(index: number, key: string, lookCount: number): number {
  const last = lookCount + 1;
  switch (key) {
    case "ArrowRight": case "PageDown": case " ": return Math.min(last, index + 1);
    case "ArrowLeft": case "PageUp": return Math.max(0, index - 1);
    case "Home": return 0;
    case "End": return last;
    default: return index;
  }
}
