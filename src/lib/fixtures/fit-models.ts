// Original schematic avatars drawn in SVG for this demo. They depict no real
// person and contain no photography; rights are held by the project.
import type { FitModel } from "@/lib/types/handoff";

const RIGHTS = "Original schematic artwork created for the RACO demo; free to use in this application.";
const PROVENANCE = "Hand-authored SVG avatar · not derived from any photograph or real individual";

export const FIT_MODELS: FitModel[] = [
  { id: "fm_a", name: "Avatar A", poses: ["standing", "walking", "three_quarter"], view: "front", representation: "Schematic figure, medium height, straight proportions", provenance: PROVENANCE, usageRights: RIGHTS },
  { id: "fm_b", name: "Avatar B", poses: ["standing", "walking"], view: "front", representation: "Schematic figure, taller, longer leg line", provenance: PROVENANCE, usageRights: RIGHTS },
  { id: "fm_c", name: "Avatar C", poses: ["standing", "three_quarter"], view: "front", representation: "Schematic figure, petite, softer shoulder", provenance: PROVENANCE, usageRights: RIGHTS },
];

export const POSE_LABEL = { standing: "Standing", walking: "Walking", three_quarter: "Three-quarter" } as const;
export const BACKGROUNDS = {
  paper: { label: "Studio paper", fill: "#EFEBE4" },
  stone: { label: "Warm stone", fill: "#CFC6B8" },
  ink: { label: "Ink", fill: "#1C1C1E" },
} as const;
