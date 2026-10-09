import { notFound } from "next/navigation";
import { CollectionBoard } from "@/components/collections/collection-board";
import { ORG } from "@/lib/fixtures";
import { repo } from "@/lib/services";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: repo.getCollection(ORG.id, id)?.name ?? "Collection" };
}

export default async function CollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collection = repo.getCollection(ORG.id, id);
  if (!collection) notFound();
  return <CollectionBoard collection={collection} />;
}
