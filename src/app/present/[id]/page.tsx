import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PresentationView } from "@/components/collections/presentation-view";
import { StoreHydrator } from "@/components/shell/store-hydrator";
import { ORG } from "@/lib/fixtures";
import { repo } from "@/lib/services";

export const metadata: Metadata = { title: "Presentation" };

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!repo.getCollection(ORG.id, id)) notFound();
  return (
    <>
      <StoreHydrator />
      <PresentationView collectionId={id} />
    </>
  );
}
