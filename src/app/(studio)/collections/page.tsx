import type { Metadata } from "next";
import { CollectionsList } from "@/components/collections/collections-list";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Collections" };

export default function CollectionsPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Library"
        title="Collections"
        description="Seasonal lines and capsules. Save concepts here from the Design Studio. Boards, ordering, notes and presentation mode arrive in Phase 4."
      />
      <CollectionsList />
    </div>
  );
}
