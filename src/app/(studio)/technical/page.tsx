import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TechnicalView } from "@/components/technical/technical-view";
import { FLAGS } from "@/lib/config/flags";

export const metadata: Metadata = { title: "Technical Handoff" };

export default function TechnicalPage() {
  if (!FLAGS.technicalDevelopment) notFound();
  return (
    <Suspense>
      <TechnicalView />
    </Suspense>
  );
}
