import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { FLAGS } from "@/lib/config/flags";

export const metadata: Metadata = { title: "Virtual Try-On" };

export default function TryOnPage() {
  if (!FLAGS.virtualTryOn) notFound();
  return (
    <ModulePlaceholder
      eyebrow="Visualisation"
      title="Virtual Try-On"
      description="Preview a garment on a consented sample model. A visual approximation only — not fit, sizing or drape simulation."
      capability="simulated"
      phase={5}
      scope={[
        "Sample model and garment selection",
        "Consent and usage-rights confirmation",
        "Queued and running states via the provider adapter",
        "Before / after view with Simulated label",
      ]}
      notice="Try-on output will never be presented as physically accurate garment simulation."
    />
  );
}
