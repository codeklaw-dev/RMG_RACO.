// The five guided-demo scenes. Links point at curated, stable demo records so
// the walkthrough works in a clean session.
import { FLAGS } from "@/lib/config/flags";
import { DEMO_CONCEPT_ID } from "@/lib/fixtures/demo";

export interface DemoScene {
  id: string;
  title: string;
  summary: string;
  steps: { label: string; href: string }[];
  cues: string[];
}

export function demoScenes(flags: Pick<typeof FLAGS, "virtualTryOn" | "technicalDevelopment"> = FLAGS): DemoScene[] {
  const handoffSteps = [
    ...(flags.virtualTryOn ? [{ label: "Conceptual try-on", href: `/try-on?concept=${DEMO_CONCEPT_ID}` }] : []),
    ...(flags.technicalDevelopment ? [{ label: "Technical brief", href: "/technical?brief=brief_demo_1" }] : []),
    { label: "Pilot readiness", href: "/pilot" },
  ];
  return [
    {
      id: "brand", title: "Brand intelligence", summary: "How a garment company defines its creative language.",
      steps: [{ label: "Brand DNA overview", href: "/brand-dna#overview" }, { label: "Creative rules", href: "/brand-dna#rules" }],
      cues: ["Serein Atelier's approved profile and version history", "Palette with signature colours", "Rules vs exclusions — only structured rules are checked", "Approval is explicit; drafts never condition generation"],
    },
    {
      id: "generate", title: "Generate concepts", summary: "A structured brief becomes brand-aware concepts.",
      steps: [{ label: "Design Studio", href: "/studio" }],
      cues: ["Try the 'Oversized blazer' example", "Switch Explore → Brand → Hybrid and watch the request preview", "Generate 4 — progress is demonstration progress, results are Simulated", "Select a result: brand consistency per rule in the inspector"],
    },
    {
      id: "refine", title: "Refine a design", summary: "Non-destructive revisions with annotations and comparison.",
      steps: [{ label: "Design Editor", href: `/editor?concept=${DEMO_CONCEPT_ID}` }],
      cues: ["Version timeline: v1 original, v2 designer edit", "Annotations pinned to versions", "Refine: 'Use linen instead of wool' → new version", "Compare slider · Brand tab recalculates alignment"],
    },
    {
      id: "collection", title: "Build a collection", summary: "Curate, review and present a seasonal line.",
      steps: [{ label: "Collection board", href: "/collections/col_aw26" }, { label: "Presentation", href: "/present/col_aw26" }],
      cues: ["Reorder looks (drag or Earlier/Later)", "Creative direction and garment notes", "Submit → approve a look (simulated review)", "Present: arrow keys, N for notes, Esc to exit"],
    },
    {
      id: "handoff", title: "Preview & handoff", summary: "From approved concept to a preliminary development brief.",
      steps: handoffSteps,
      cues: [
        ...(flags.virtualTryOn ? ["Generate a conceptual fitting preview — labelled, not physically accurate"] : []),
        ...(flags.technicalDevelopment ? ["Technical brief prefilled from concept metadata only", "Edit measurements (cm/in), export the PDF with its disclaimer"] : []),
        "Close on the pilot plan: what's real, simulated and production-required",
      ],
    },
  ];
}
