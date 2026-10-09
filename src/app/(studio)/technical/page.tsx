import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "Technical Development" };

export default function TechnicalPage() {
  return (
    <ModulePlaceholder
      eyebrow="Technical development"
      title="Technical Handoff"
      description="Concept metadata, materials notes and an exportable brief, preparing designs for product development."
      capability="planned"
      phase={5}
      scope={[
        "Concept brief: metadata, materials, construction notes",
        "Measurement and point-of-measure placeholders",
        "Future: tech pack, CAD pattern, grading, BOM integrations",
      ]}
      notice="Tech packs, patterns and manufacturing tolerances are future integrations and are not generated here."
    />
  );
}
