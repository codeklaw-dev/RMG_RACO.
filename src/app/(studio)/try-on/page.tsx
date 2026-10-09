import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TryOnView } from "@/components/try-on/try-on-view";
import { FLAGS } from "@/lib/config/flags";

export const metadata: Metadata = { title: "Virtual Try-On" };

export default function TryOnPage() {
  if (!FLAGS.virtualTryOn) notFound();
  return (
    <Suspense>
      <TryOnView />
    </Suspense>
  );
}
