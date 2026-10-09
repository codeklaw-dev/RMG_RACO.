import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "Design Studio" };

export default function StudioPage() {
  return (
    <ModulePlaceholder
      eyebrow="AI Design Studio"
      title="Design Studio"
      description="Compose a garment brief in words and references, then explore variations in Explore, Brand or Hybrid mode."
      capability="simulated"
      phase={2}
      scope={[
        "Prompt composer: category, silhouette, season, fabric, palette, audience",
        "Reference image upload with rights acknowledgement",
        "Explore / Brand / Hybrid mode and creativity control",
        "Queued, running, failed and cancelled job states",
        "Concept grid: compare, favourite, variation, add to collection",
      ]}
      notice="Outputs in this demo are curated fixtures labelled Simulated. No live image model is connected."
    />
  );
}
