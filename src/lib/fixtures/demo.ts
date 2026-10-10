// Curated, deterministic demo records layered on the base fixtures so the
// guided demo works in a clean browser session. Stable ids, fixed timestamps.
import { originalVersion } from "@/lib/editor/versions";
import { createBrief } from "@/lib/handoff/technical";
import type { ConceptVersion, DesignAnnotation, DesignReview } from "@/lib/types/domain";
import { TRY_ON_LABEL, type TechBrief, type TryOnPreview } from "@/lib/types/handoff";
import { CONCEPTS } from "./index";

export const DEMO_CONCEPT_ID = "cpt_01"; // Extended-shoulder wrap coat · AW26 · approved
const hero = CONCEPTS.find((c) => c.id === DEMO_CONCEPT_ID)!;
const v1 = originalVersion(hero);

const v2: ConceptVersion = {
  ...v1,
  id: `${hero.id}_v2`,
  parentId: v1.id,
  number: 2,
  summary: "detail: concealed placket · notes",
  operation: "manual",
  instruction: "Designer edit after fitting review",
  changes: [
    { attribute: "detail", from: (v1.snapshot.details ?? []).join(", "), to: "concealed placket, hand-felled hems" },
    { attribute: "notes", from: "—", to: "Shoulder reduced 1 cm after review" },
  ],
  snapshot: { ...v1.snapshot, details: ["concealed placket", "hand-felled hems"], notes: "Shoulder reduced 1 cm after review", seed: 41 },
  provenance: "Designer edit · metadata snapshot · schematic placeholder",
  imageAssetId: `placeholder/${hero.id}_v2`,
  jobId: null,
  createdAt: "2026-10-08T10:20:00Z",
};

export const DEMO_VERSIONS: ConceptVersion[] = [v2];
export const DEMO_HEAD: Record<string, string> = { [hero.id]: v2.id };

export const DEMO_ANNOTATIONS: DesignAnnotation[] = [
  { id: "ann_demo_1", orgId: hero.orgId, conceptId: hero.id, versionId: v1.id, x: 0.3, y: 0.17, view: "front", text: "Reduce shoulder width", category: "fit", resolved: true, createdAt: "2026-10-07T15:00:00Z", updatedAt: "2026-10-08T10:20:00Z" },
  { id: "ann_demo_2", orgId: hero.orgId, conceptId: hero.id, versionId: v2.id, x: 0.5, y: 0.42, view: "front", text: "Explore a concealed fastening — done in v2", category: "construction", resolved: false, createdAt: "2026-10-08T10:25:00Z", updatedAt: "2026-10-08T10:25:00Z" },
];

export const DEMO_REVIEWS: DesignReview[] = [
  { id: "rev_demo_2", conceptId: hero.id, versionId: v2.id, from: "in_review", to: "approved", note: "Approved for AW26 line review", actor: "Amara Okafor (simulated)", at: "2026-10-08T16:00:00Z" },
  { id: "rev_demo_1", conceptId: hero.id, versionId: v2.id, from: "draft", to: "in_review", note: "", actor: "Amara Okafor (simulated)", at: "2026-10-08T11:00:00Z" },
];

const brief = createBrief({ ...hero, ...v2.snapshot, currentVersionId: v2.id }, v2, "2026-10-09T09:00:00Z");
export const DEMO_BRIEFS: TechBrief[] = [
  {
    ...brief,
    id: "brief_demo_1",
    measurements: brief.measurements.map((m, i) => ({ ...m, id: `m_demo_${i}` })),
    bom: brief.bom.map((l, i) => ({ ...l, id: `bom_demo_${i}` })),
    construction: { ...brief.construction, neckline: "Notched collar, to be confirmed at toile stage" },
  },
];

const preview = (id: string, modelId: string, pose: TryOnPreview["pose"], background: TryOnPreview["background"], colour: string | null): TryOnPreview => ({
  id, orgId: hero.orgId, conceptId: hero.id, versionId: v2.id, versionNumber: 2, modelId, pose, background, colour,
  garment: { title: v2.snapshot.title, silhouette: v2.snapshot.silhouette, palette: v2.snapshot.palette, seed: v2.snapshot.seed },
  jobId: null, label: TRY_ON_LABEL,
  provenance: "Composited by demo adapter from schematic avatar + schematic garment · no try-on model, no fit or drape simulation",
  saved: true, createdAt: "2026-10-09T09:30:00Z",
});

export const DEMO_PREVIEWS: TryOnPreview[] = [
  preview("tryon_demo_1", "fm_a", "standing", "paper", null),
  preview("tryon_demo_2", "fm_b", "walking", "stone", "#1C1C1E"),
  preview("tryon_demo_3", "fm_c", "three_quarter", "ink", "#8C2F37"),
];
