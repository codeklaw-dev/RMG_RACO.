"use client";
import { ConceptCard } from "@/components/shared/concept-card";
import { PageHeader } from "@/components/shared/page-header";
import { Reveal } from "@/components/shared/reveal";
import { useStudioStore } from "@/lib/store/studio-store";
import type { Collection } from "@/lib/types/domain";

export function CollectionBoard({ collection }: { collection: Collection }) {
  const looks = useStudioStore((s) => s.concepts.filter((c) => collection.conceptIds.includes(c.id)));
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={`${collection.season} · ${collection.status.replace("_", " ")}`}
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
