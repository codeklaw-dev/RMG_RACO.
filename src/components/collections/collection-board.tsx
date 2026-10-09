"use client";
import { useShallow } from "zustand/react/shallow";
import { ConceptCard } from "@/components/shared/concept-card";
import { PageHeader } from "@/components/shared/page-header";
import { Reveal } from "@/components/shared/reveal";
import { useStudioStore } from "@/lib/store/studio-store";
import type { Collection } from "@/lib/types/domain";

export function CollectionBoard({ collection: initial }: { collection: Collection }) {
  const collection = useStudioStore((s) => s.collections.find((c) => c.id === initial.id)) ?? initial;
  const looks = useStudioStore(
    useShallow((s) => collection.conceptIds.map((id) => s.concepts.find((c) => c.id === id)).filter((c) => c !== undefined)),
  );
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`${collection.season} · ${collection.status.replace("_", " ")} · ${looks.length} looks`}
        title={collection.name}
        description={collection.description}
      />
      <Reveal className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {looks.map((c) => (
          <ConceptCard key={c.id} concept={c} />
        ))}
      </Reveal>
    </div>
  );
}
