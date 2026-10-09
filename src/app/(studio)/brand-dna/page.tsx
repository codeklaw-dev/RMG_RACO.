import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "Brand DNA" };

export default function BrandDnaPage() {
  return (
    <ModulePlaceholder
      eyebrow="Brand intelligence"
      title="Brand DNA"
      description="The brand's design language as an editable, versioned profile. Every rule cites the references it came from."
      capability="simulated"
      phase={3}
      scope={[
        "Moodboards and archive references with rights metadata",
        "Palette, silhouettes, fabric vocabulary",
        "Style rules and exclusions with cited sources",
        "Approval and version history",
        "Live preview of the request metadata Brand mode sends",
      ]}
      notice="Brand learning in this demo is profile conditioning and reference retrieval, not model fine-tuning."
    />
  );
}
