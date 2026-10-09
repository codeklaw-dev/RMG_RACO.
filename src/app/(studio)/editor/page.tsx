import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "Design Editor" };

export default function EditorPage() {
  return (
    <ModulePlaceholder
      eyebrow="Design Editor"
      title="Design Editor"
      description="Review a single concept, refine it conversationally and keep every version. Originals are never overwritten."
      capability="simulated"
      phase={4}
      scope={[
        "Large canvas with zoom and pan",
        "Natural-language edit instructions",
        "Region selection mask",
        "Before / after comparison",
        "Version timeline with revert and duplicate",
      ]}
    />
  );
}
